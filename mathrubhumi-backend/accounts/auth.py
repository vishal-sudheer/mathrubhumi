import logging

from django.db import connection
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import is_admin_user
from .models import UserBranch

logger = logging.getLogger(__name__)

ALLOWED_APP_ROLES = {"admin", "manager", "staff"}


def _normalize_role(role_name: str | None, *, admin: bool) -> str:
    if admin:
        return "Admin"
    rn = (role_name or "").strip().lower()
    if rn in ALLOWED_APP_ROLES:
        return rn.title()
    return "Staff"


def _get_branch(branch_id: int):
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, branches_nm
              FROM branches
             WHERE id = %s
            """,
            [branch_id],
        )
        row = cursor.fetchone()
    if not row:
        return None
    return {"id": row[0], "branches_nm": row[1] or ""}


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    username_field = "email"
    branch_id = serializers.IntegerField(write_only=True, required=True, min_value=1)

    def validate(self, attrs):
        branch_id = int(attrs.get("branch_id"))
        branch = _get_branch(branch_id)
        if not branch:
            raise serializers.ValidationError({"branch_id": "Invalid branch."})

        data = super().validate(attrs)

        user = self.user
        raw_role_name = getattr(getattr(user, "role", None), "name", None)
        admin = is_admin_user(user)
        if not admin:
            if not UserBranch.objects.filter(user=user, branch_id=branch_id).exists():
                raise serializers.ValidationError({"branch_id": "You are not assigned to this branch."})
        role_name = _normalize_role(raw_role_name, admin=admin)

        data["user"] = {
            "id": user.id,
            "email": user.email,
            "name": getattr(user, "name", "") or user.email,
            "role": role_name,
            "is_admin": admin,
        }
        data["branch"] = branch
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def branches_list(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, branches_nm
                  FROM branches
                 ORDER BY branches_nm ASC
                """
            )
            rows = cursor.fetchall()
        return Response([{"id": r[0], "branches_nm": r[1] or ""} for r in rows])
    except Exception as e:
        logger.exception("Error in branches_list")
        return Response({"error": "An unexpected error occurred."}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    raw_role_name = getattr(getattr(user, "role", None), "name", None)
    admin = is_admin_user(user)
    role_name = _normalize_role(raw_role_name, admin=admin)

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "name": getattr(user, "name", "") or user.email,
            "role": role_name,
            "is_admin": admin,
        }
    )
