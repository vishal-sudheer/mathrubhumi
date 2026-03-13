"""
Health check endpoints for production monitoring.
"""
from django.http import JsonResponse
from django.db import connection


def health_check(request):
    """
    Simple health check endpoint for load balancers and monitoring.
    Returns 200 if the application is healthy and database is connected.
    Returns 503 if there are issues.
    """
    try:
        # Check database connectivity
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        return JsonResponse({
            "status": "healthy",
            "database": "connected"
        })
    except Exception as e:
        return JsonResponse({
            "status": "unhealthy",
            "error": "Database connection failed."
        }, status=503)


def readiness_check(request):
    """
    Readiness check for Kubernetes-style deployments.
    Indicates if the service is ready to receive traffic.
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        
        return JsonResponse({"ready": True})
    except Exception:
        return JsonResponse({"ready": False}, status=503)
