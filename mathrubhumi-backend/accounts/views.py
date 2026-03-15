import json
import logging
import decimal
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework import status
from django.contrib.auth import authenticate, login
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import CustomUser, Role
from django.db import transaction, connection, IntegrityError
from django.http import JsonResponse, HttpResponse
from django.utils.dateparse import parse_date
from .permissions import is_admin_user

logger = logging.getLogger(__name__)

sale_bill_type_mapping = {
    'Credit Sale': 'CREDIT_SALE',
    'Cash Sale': 'CASH_SALE',
    'P P Sale': 'PP_SALE',
    'Stock Transfer': 'ST_SALE',
    'Approval': 'APPROVAL_SALE',
    'Gift Voucher': 'GIFT_V_SALE',
    'Gift Bill': 'GIFT_B_SALE',
    'Cash Memo': 'CASH_SALE',
}

sale_type_mapping = {
    0: "Credit Sale",
    1: "Cash Sale",
    2: "P P Sale",
    3: "Stock Transfer",
    4: "Approval",
    5: "Gift Voucher",
    6: "Gift Bill",
    7: "Cash Memo"
}
sale_type_reverse_mapping = {v: k for k, v in sale_type_mapping.items()}

payment_type_mapping = {
    0: "Cash",
    1: "Cards Books",
    2: "Cash Chq",
    3: "N.A.",
    4: "Digital Payment",
    5: "Card Periodical",
    6: "Card Calender",
    7: "Card Diary",
    8: "Card Paperbox",
    9: "Card Others"
}
payment_type_reverse_mapping = {v: k for k, v in payment_type_mapping.items()}

sale_mode_mapping = {
    0: "Cash",
    1: "Card",
    2: "UPI",
    3: "N.A."
}
sale_mode_reverse_mapping = {v: k for k, v in sale_mode_mapping.items()}

class_type_mapping = {
    0: "Individual",
    1: "Educational Instt - School",
    2: "Educational Instt - College",
    3: "Local Library",
    4: "Local Bodies",
    5: "Commission Agents",
    6: "Agents",
    7: "Other Book Shops",
    8: "Corporate Firms",
    9: "Not Applicable",
    10: "Staff",
    11: "Freelancers",
    12: "Authors",
    13: "Section"
}
class_type_reverse_mapping = {v: k for k, v in class_type_mapping.items()}


def _coerce_int(value, default=0):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        if value == '':
            return default
    return int(value)


def _coerce_float(value, default=0.0):
    if value is None:
        return default
    if isinstance(value, str):
        value = value.strip()
        if value == '':
            return default
    return float(value)


def _decimal_to_float(value, default=0.0):
    if value is None:
        return default
    if isinstance(value, decimal.Decimal):
        return float(value)
    return float(value)


def _get_request_company_id(request) -> int:
    branch_id_header = request.headers.get('X-Branch-Id')
    if branch_id_header is None:
        raise ValueError('Missing X-Branch-Id header.')

    company_id = int(branch_id_header)
    if company_id <= 0:
        raise ValueError('Invalid X-Branch-Id header.')

    return company_id

def get_next_value(company_id: int, fin_year: str, code: str) -> int:
    query = """
           UPDATE public."last_values" SET last_value = last_value + 1
            WHERE company_id = %s AND fin_year = %s AND code = %s
        RETURNING last_value;
    """
    with connection.cursor() as cursor:
        cursor.execute(query, [company_id, fin_year, code])
        result = cursor.fetchone()
        return result[0] if result else -1


def _get_sale_payload(*, sale_id=None, bill_no=None, company_id=None):
    if sale_id is None and bill_no is None:
        raise ValueError('Either sale_id or bill_no is required.')

    sale_where = ""
    sale_params = []

    if sale_id is not None:
        sale_where = "S.id = %s"
        sale_params = [sale_id]
    else:
        sale_where = "S.bill_no = %s AND S.company_id = %s"
        sale_params = [bill_no, company_id]

    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT S.id,
                S.customer_nm,
                S.billing_address,
                S.sale_date,
                S.mobile_number,
                S.type,
                S.mode,
                S.class,
                S.cancel,
                S.bill_discount,
                S.bill_discount_amount,
                S.gross,
                S.round_off,
                S.bill_amount,
                S.note_1,
                S.note_2,
                S.freight_postage,
                S.processing_charge,
                S.bill_no,
                S.agent_id,
                COALESCE(A.agent_nm, '') AS agent_nm,
                S.branch_id,
                S.cr_customer_id
            FROM sales S
            LEFT JOIN agents A ON A.id = S.agent_id
            WHERE {sale_where}
            ORDER BY S.id DESC
            LIMIT 1
            """,
            sale_params,
        )
        sale = cursor.fetchone()
        if not sale:
            return None

        sale_type_label = sale_type_mapping.get(sale[5], str(sale[5]))
        payment_type_label = sale_mode_mapping.get(sale[6], str(sale[6]))
        class_type_label = class_type_mapping.get(sale[7], str(sale[7]))

        sale_data = {
            'id': sale[0],
            'customer_nm': sale[1],
            'billing_address': sale[2],
            'sale_date': sale[3],
            'mobile_number': sale[4],
            'type': sale_type_label,
            'mode': payment_type_label,
            'class': class_type_label,
            'cancel': 'Yes' if sale[8] == 1 else 'No',
            'bill_discount': float(sale[9]) if sale[9] is not None else 0.0,
            'bill_discount_amount': float(sale[10]) if sale[10] is not None else 0.0,
            'gross': float(sale[11]) if sale[11] is not None else 0.0,
            'round_off': float(sale[12]) if sale[12] is not None else 0.0,
            'bill_amount': float(sale[13]) if sale[13] is not None else 0.0,
            'note_1': sale[14] or '',
            'note_2': sale[15] or '',
            'freight_postage': float(sale[16]) if sale[16] is not None else 0.0,
            'processing_charge': float(sale[17]) if sale[17] is not None else 0.0,
            'bill_no': sale[18],
            'agent_id': sale[19] or 0,
            'agent_nm': sale[20] or '',
            'branch_id': sale[21] or 0,
            'customer_id': sale[22] or 0,
            'items': [],
        }

        cursor.execute(
            """
            SELECT CASE WHEN T.language_id = 1 THEN T.title_m ELSE T.title END AS item_name,
                   SI.exchange_rate,
                   SI.quantity,
                   SI.rate,
                   SI.tax,
                   SI.discount_p,
                   SI.line_value,
                   SI.currency_id,
                   SI.title_id,
                   T.language_id,
                   C.currency_name,
                   SI.allocated_bill_discount,
                   SI.purchase_company_id,
                   SI.purchase_id,
                   SI.purchase_item_id
              FROM sale_items SI
              JOIN titles T ON (SI.title_id = T.id)
              JOIN currencies C ON (SI.currency_id = C.id)
             WHERE SI.sale_id = %s
            """,
            [sale[0]],
        )
        items = cursor.fetchall()
        for item in items:
            sale_data['items'].append({
                'itemName': item[0],
                'exchangeRate': float(item[1]) if item[1] is not None else 0.0,
                'quantity': float(item[2]),
                'rate': float(item[3]),
                'tax': float(item[4]) if item[4] is not None else 0.0,
                'discount': float(item[5]) if item[5] is not None else 0.0,
                'value': float(item[6]),
                'currencyIndex': int(item[7]),
                'titleId': int(item[8]),
                'language': int(item[9]),
                'currency': item[10],
                'allocatedBillDiscount': float(item[11]) if item[11] is not None else 0.0,
                'purchaseCompanyId': int(item[12]) if item[12] is not None else 0,
                'purchaseId': int(item[13]) if item[13] is not None else 0,
                'purchaseItemId': int(item[14]) if item[14] is not None else 0,
            })

    return sale_data

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_view(request):
    user = request.user
    return Response({'message': f'Hello {user.username}, you are authenticated!'})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_user(request):
    if not is_admin_user(request.user):
        return Response({"error": "Admin permissions required."}, status=status.HTTP_403_FORBIDDEN)

    data = request.data or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()
    role_name = (data.get("role") or "Staff").strip()

    if not email or not password or not name:
        return Response({"error": "Missing fields"}, status=status.HTTP_400_BAD_REQUEST)

    if role_name.lower() not in {"manager", "staff"}:
        return Response({"error": "Role must be Manager or Staff"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(password)
    except ValidationError as e:
        return Response({"error": e.messages}, status=status.HTTP_400_BAD_REQUEST)

    if CustomUser.objects.filter(email=email).exists():
        return Response({"error": "User already exists"}, status=status.HTTP_400_BAD_REQUEST)

    role, _ = Role.objects.get_or_create(name=role_name.title())
    user = CustomUser.objects.create_user(email=email, password=password, name=name, role=role)

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": role.name,
        },
        status=status.HTTP_201_CREATED,
    )


################### SUGGESTIONS ###################

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_books_title_search(request):
    """
    Returns PP Book suggestions using:
    SELECT ppb.id, t.title
      FROM pp_books ppb
      JOIN publishers p ON (ppb.pp_book_firm_id = p.id)
      JOIN titles t ON (ppb.product_id = t.id)
     WHERE t.title ILIKE %q%
     LIMIT 50
    """
    try:
      q = request.GET.get('q', '')
      company_id = _get_request_company_id(request)
      if len(q) < 2:
          return JsonResponse({'error': 'Query must be at least 2 characters'}, status=400)
      with connection.cursor() as cur:
          cur.execute(
              """
              SELECT ppb.id, t.title
                FROM pp_books ppb
                JOIN publishers p ON (ppb.pp_book_firm_id = p.id)
                JOIN titles t ON (ppb.product_id = t.id)
               WHERE ppb.company_id = %s AND t.title ILIKE %s
               ORDER BY t.title
               LIMIT 50
              """,
              [company_id, f'%{q}%']
          )
          rows = cur.fetchall()
      out = [{'id': r[0], 'title': r[1] or ''} for r in rows]
      return JsonResponse(out, safe=False, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
      logger.exception("Error in pp_books_title_search")
      return JsonResponse({'error': 'An unexpected error occurred.'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_customers_name_search(request):
    """
    Returns pp_customer suggestions with customer details used by PP Receipt Entry.
    """
    try:
      q = request.GET.get('q', '')
      company_id = _get_request_company_id(request)
      if len(q) < 2:
          return JsonResponse({'error': 'Query must be at least 2 characters'}, status=400)
      with connection.cursor() as cur:
          cur.execute(
              """
              SELECT id, pp_customer_nm, address1, address2, city, telephone, pin
                FROM pp_customers
               WHERE company_id = %s AND pp_customer_nm ILIKE %s
               ORDER BY pp_customer_nm
               LIMIT 50
              """,
              [company_id, f'%{q}%']
          )
          rows = cur.fetchall()
      out = [{
          'id': r[0],
          'pp_customer_nm': r[1] or '',
          'address1': r[2] or '',
          'address2': r[3] or '',
          'city': r[4] or '',
          'telephone': r[5] or '',
          'pin': (r[6] or '').strip(),
      } for r in rows]
      return JsonResponse(out, safe=False, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
      logger.exception("Error in pp_customers_name_search")
      return JsonResponse({'error': 'An unexpected error occurred.'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agents_name_search(request):
    """
    Returns distinct agent_nm from agents for suggestions.
    """
    try:
      q = request.GET.get('q', '')
      if len(q) < 2:
          return JsonResponse({'error': 'Query must be at least 2 characters'}, status=400)
      with connection.cursor() as cur:
          cur.execute(
              """
              SELECT MIN(id) AS id, agent_nm
                FROM agents
               WHERE agent_nm ILIKE %s
               GROUP BY agent_nm
               ORDER BY agent_nm
               LIMIT 50
              """,
              [f'%{q}%']
          )
          rows = cur.fetchall()
      out = [{'id': r[0], 'agent_nm': r[1] or ''} for r in rows]
      return JsonResponse(out, safe=False, json_dumps_params={'ensure_ascii': False})
    except Exception as e:
      logger.exception("Error in agents_name_search")
      return JsonResponse({'error': 'An unexpected error occurred.'}, status=400)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def remittance_customer_search(request):
    """
    Suggestions for Customer (cr_customers.customer_nm).
    GET /auth/remittance-customer-search/?q=...
    """
    try:
        q = request.GET.get('q', '').strip()
        if len(q) < 1:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, customer_nm
                  FROM cr_customers
                 WHERE customer_nm ILIKE %s
                 ORDER BY customer_nm ASC
                 LIMIT 50
                """,
                [f"%{q}%"]
            )
            rows = cursor.fetchall()

        data = [{"id": r[0], "customer_nm": r[1] or ""} for r in rows]
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in remittance_customer_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in remittance_customer_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in remittance_customer_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_receipt_by_customer_id(request):
    """
    Load receipts by customer id. Returns all necessary fields so the UI can fill everything.
    """
    try:
        company_id = _get_request_company_id(request)
        customer_id = request.GET.get('customer_id', '').strip()
        if not customer_id:
            return JsonResponse({'error': 'customer is required'}, status=400)

        with connection.cursor() as cur:
            cur.execute("""
                SELECT
                    r.receipt_no,
                    r.entry_date,
                    r.bank,
                    r.chq_dd_no,
                    r.amount
                FROM pp_receipts r
                WHERE r.company_id = %s AND r.pp_customer_id = %s AND r.a_type = 2
                ORDER BY r.id DESC
                LIMIT 10
            """, [company_id, customer_id])
            rows = cur.fetchall()

        data = [{"receipt_no": r[0], "entry_date": r[1], "bank": r[2], "chq_dd_no": r[3], "amount": r[4] or ""} for r in rows]
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in finding customer details.: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in finding customer details.: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in finding customer details.")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def branches_name_search(request):
    """
    Suggestions for Remitted at (branches.branches_nm).
    GET /auth/branches-name-search/?q=...
    """
    try:
        q = request.GET.get('q', '').strip()
        if len(q) < 1:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, branches_nm
                  FROM branches
                 WHERE branches_nm ILIKE %s
                 ORDER BY branches_nm ASC
                 LIMIT 50
                """,
                [f"%{q}%"]
            )
            rows = cursor.fetchall()

        data = [{"id": r[0], "branches_nm": r[1] or ""} for r in rows]
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in branches_name_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in branches_name_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in branches_name_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

################### SALE BILL ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_sale(request):
    if request.method == 'POST':
        try:
            logger.debug(f"Request body: {request.body}")
            data = json.loads(request.body)
            logger.debug(f"Parsed data: {data}")

            required_fields = ['customer_nm', 'sale_date', 'mobile_number', 'type', 'mode', 'class', 'cancel']
            for field in required_fields:
                if field not in data or data[field] is None or data[field] == '':
                    logger.error(f"Validation failed: Missing or null field: {field}")
                    return JsonResponse({'error': f'Missing or null field: {field}'}, status=400)

            optional_fields = {
                'bill_discount': 0.0,
                'bill_discount_amount': 0.0,
                'gross': 0.0,
                'round_off': 0.0,
                'bill_amount': 0.0,
                'note_1': '',
                'note_2': '',
                'freight_postage': 0.0,
                'processing_charge': 0.0
            }
            for field, default in optional_fields.items():
                data[field] = data.get(field, default) if data.get(field) is not None else default

            branch_id_header = request.headers.get('X-Branch-Id')
            try:
                branch_id = int(branch_id_header)
                if branch_id <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                logger.error("Validation failed: Missing or invalid X-Branch-Id header")
                return JsonResponse({'error': 'Branch context missing. Please log in again.'}, status=400)

            # NEW: normalize agent_id
            data['agent_id'] = int(data.get('agent_id') or 0)

            if not isinstance(data['items'], list) or not data['items']:
                logger.error("Validation failed: Items must be a non-empty list")
                return JsonResponse({'error': 'Items must be a non-empty list'}, status=400)

            has_item_discount = any(float(item.get('discount', 0)) > 0 for item in data['items'])
            bill_discount = float(data['bill_discount'] or 0)
            bill_discount_amount = float(data['bill_discount_amount'] or 0)
            discount_count = (1 if has_item_discount else 0) + (1 if bill_discount > 0 else 0) + (1 if bill_discount_amount > 0 else 0)
            if discount_count > 1:
                logger.error("Validation failed: Only one of item discount, bill discount %, or bill discount amount can be applied")
                return JsonResponse({'error': 'Only one of item discount, bill discount %, or bill discount amount can be applied'}, status=400)

            try:
                bill_discount = float(data['bill_discount']) if data['bill_discount'] else 0.0
                bill_discount_amount = float(data['bill_discount_amount']) if data['bill_discount_amount'] else 0.0
                gross = float(data['gross']) if data['gross'] else 0.0
                round_off = float(data['round_off']) if data['round_off'] else 0.0
                bill_amount = float(data['bill_amount']) if data['bill_amount'] else 0.0
                for item in data['items']:
                    required_item_fields = ['itemName', 'quantity', 'exchangeRate', 'rate', 'value', 'currency', 'tax', 'currencyIndex', 'titleId']
                    for field in required_item_fields:
                        if field not in item or item[field] is None:
                            logger.error(f"Validation failed: Missing item field: {field}")
                            return JsonResponse({'error': f'Missing item field: {field}'}, status=400)
                    item['quantity'] = float(item['quantity'])
                    item['rate'] = float(item['rate'])
                    item['exchangeRate'] = float(item['exchangeRate'])
                    item['tax'] = float(item['tax']) if item.get('tax') is not None else 0.0
                    item['discount'] = float(item['discount']) if item.get('discount') else 0.0
                    item['value'] = float(item['value'])
                    item['currencyIndex'] = int(item['currencyIndex'])
                    item['titleId'] = int(item['titleId'])
                    item['purchaseItemId'] = int(item.get('purchaseItemId') or 0)
            except (ValueError, TypeError) as e:
                logger.exception("Invalid data type")
                return JsonResponse({'error': 'Invalid data format.'}, status=400)

            # If not credit sale, set the cr_customer_id to 0
            # (0 is "Credit Sale" in your sale_type_reverse_mapping)
            data['customer_id'] = (
                0 if sale_type_reverse_mapping.get(data['type'], -1) != 0
                else data.get('customer_id', 0)
            )

            # Calculate allocated bill discount for each item
            total_value = sum(item['value'] for item in data['items'])
            for item in data['items']:
                item['allocatedBillDiscount'] = 0.0
                if not has_item_discount and total_value > 0:
                    if bill_discount > 0:
                        total_discount = gross * bill_discount / 100
                        item['allocatedBillDiscount'] = (item['value'] / total_value) * total_discount
                    elif bill_discount_amount > 0:
                        item['allocatedBillDiscount'] = (item['value'] / total_value) * bill_discount_amount

            with transaction.atomic():
                sale_type = sale_bill_type_mapping.get(data['type'], 'CREDIT_SALE')
                bill_no = get_next_value(branch_id, '2526', sale_type)
                bill_no = '2025-26/' + f"{bill_no:05d}"

                user_id = int(getattr(request.user, 'id', 0) or 0)
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO sales (
                            customer_nm, billing_address, sale_date, mobile_number,
                            type, mode, class, cancel,
                            bill_discount, bill_discount_amount, gross, round_off, bill_amount,
                            note_1, note_2, freight_postage, processing_charge,
                            bill_no, cr_customer_id, user_id, agent_id, company_id, branch_id
                        )
                        VALUES (%s, %s, %s, %s,
                                %s, %s, %s, %s,
                                %s, %s, %s, %s, %s,
                                %s, %s, %s, %s,
                                %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        [
                            data['customer_nm'],
                            data['billing_address'],
                            data['sale_date'],
                            data['mobile_number'],
                            sale_type_reverse_mapping.get(data['type'], -1),
                            sale_mode_reverse_mapping.get(data['mode'], -1),
                            class_type_reverse_mapping.get(data['class'], -1),
                            1 if data['cancel'] == 'Yes' else 0,
                            bill_discount,
                            bill_discount_amount,
                            gross,
                            round_off,
                            bill_amount,
                            data['note_1'],
                            data['note_2'],
                            data['freight_postage'],
                            data['processing_charge'],
                            bill_no,
                            data['customer_id'],       # cr_customer_id
                            user_id,
                            int(data.get('agent_id') or 0),
                            branch_id,
                            branch_id,
                        ]
                    )
                    sale_id = cursor.fetchone()[0]

                    for item in data['items']:
                        cursor.execute(
                            """
                            INSERT INTO sale_items (
                                sale_id, exchange_rate, quantity, rate, tax, discount_p, line_value, currency_id, title_id, allocated_bill_discount,
                                purchase_company_id, purchase_id, purchase_item_id, company_id
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            [
                                sale_id,
                                item['exchangeRate'],
                                item['quantity'],
                                item['rate'],
                                item['tax'],
                                item['discount'],
                                item['value'],
                                item['currencyIndex'],
                                item['titleId'],
                                item['allocatedBillDiscount'],
                                item['purchaseCompanyId'],
                                item['purchaseId'],
                                item['purchaseItemId'],
                                branch_id,
                            ]
                        )

            logger.info(f"Sale created successfully with ID: {sale_id}")
            return JsonResponse({'message': 'Sale saved successfully', 'sale_id': sale_id}, status=201)

        except KeyError as e:
            logger.warning("Missing required field in create_sale: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in create_sale: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in create_sale")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_goods_inward(request):
    if request.method == 'POST':
        try:
            logger.debug(f"Request body: {request.body}")
            data = json.loads(request.body)
            logger.debug(f"Parsed data: {data}")

            required_fields = ['supplier_id', 'bill_no', 'bill_date', 'user_id', 'branches_id']
            for field in required_fields:
                if field not in data or data[field] is None or data[field] == '':
                    logger.error(f"Validation failed: Missing or null field: {field}")
                    return JsonResponse({'error': f'Missing or null field: {field}'}, status=400)

            branch_id_header = request.headers.get('X-Branch-Id')
            try:
                branch_id = int(branch_id_header)
                if branch_id <= 0:
                    raise ValueError
            except (TypeError, ValueError):
                logger.error("Validation failed: Missing or invalid X-Branch-Id header")
                return JsonResponse({'error': 'Branch context missing. Please log in again.'}, status=400)

            try:
                gross = _coerce_float(data.get('gross'), 0.0)
                nett = _coerce_float(data.get('nett'), 0.0)
                p_breakup_id1 = _coerce_int(data.get('p_breakup_id1'), 0)
                p_breakup_amt1 = _coerce_float(data.get('p_breakup_amt1'), 0.0)
                p_breakup_id2 = _coerce_int(data.get('p_breakup_id2'), 0)
                p_breakup_amt2 = _coerce_float(data.get('p_breakup_amt2'), 0.0)
                p_breakup_id3 = _coerce_int(data.get('p_breakup_id3'), 0)
                p_breakup_amt3 = _coerce_float(data.get('p_breakup_amt3'), 0.0)
                p_breakup_id4 = _coerce_int(data.get('p_breakup_id4'), 0)
                p_breakup_amt4 = _coerce_float(data.get('p_breakup_amt4'), 0.0)
                for item in data['items']:
                    required_item_fields = ['itemName', 'isbn', 'quantity', 'purchaseRate', 'exchangeRate', 'currency', 'tax', 'discount', 'discountAmount', 'value', 'titleId', 'currencyIndex']
                    for field in required_item_fields:
                        if field not in item or item[field] is None:
                            logger.error(f"Validation failed: Missing item field: {field}")
                            return JsonResponse({'error': f'Missing item field: {field}'}, status=400)
                    item['quantity'] = float(item['quantity'])
                    item['purchaseRate'] = float(item['purchaseRate'])
                    item['exchangeRate'] = float(item['exchangeRate'])
                    item['tax'] = float(item['tax']) if item.get('tax') is not None else 0.0
                    item['discount'] = float(item['discount']) if item.get('discount') else 0.0
                    item['discountAmount'] = float(item['discountAmount']) if item.get('discount') else 0.0
                    item['value'] = float(item['value'])
                    item['currencyIndex'] = int(item['currencyIndex'])
                    item['titleId'] = int(item['titleId'])
            except (ValueError, TypeError) as e:
                logger.exception("Invalid data type")
                return JsonResponse({'error': 'Invalid data format.'}, status=400)

            type_mapping = {'Purchase': 0, 'Sale Or Return': 1, 'Consignment': 2, 'Own Titles': 3, 'Own Periodicals': 4, "Other`s Periodicals": 5, 'Stock Transfer': 6}
            with transaction.atomic():

                # running number
                purchase_no = get_next_value(branch_id, '2526', 'PURCHASE')

                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        INSERT INTO purchase (invoice_no, invoice_date, supplier_id, nett, inward_type, transaction_type, notes, gross, p_breakup_id1, p_breakup_amount1, 
                                            p_breakup_id2, p_breakup_amount2, p_breakup_id3, p_breakup_amount3, p_breakup_id4, p_breakup_amount4, user_id, branch_id, company_id,
                                            purchase_no)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        [
                            data['bill_no'],
                            data['bill_date'],
                            data['supplier_id'],
                            nett,
                            1 if data['is_cash'] == 'Yes' else 0,
                            type_mapping.get(data['type'], -1),
                            data['notes'],
                            gross,
                            p_breakup_id1,
                            p_breakup_amt1,
                            p_breakup_id2,
                            p_breakup_amt2,
                            p_breakup_id3,
                            p_breakup_amt3,
                            p_breakup_id4,
                            p_breakup_amt4,
                            data['user_id'],
                            branch_id,
                            branch_id,
                            purchase_no
                        ]
                    )
                    purchase_id = cursor.fetchone()[0]

                    for item in data['items']:
                        cursor.execute(
                            """
                            INSERT INTO purchase_items (purchase_id, title_id, rate, exchange_rate, discount_p, discount_a, quantity, closing, currency_id, sgst, cgst, isbn, company_id)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            [
                                purchase_id,
                                item['titleId'],				
                                item['purchaseRate'],
                                item['exchangeRate'],
                                item['discount'],
                                item['discountAmount'],
                                item['quantity'],
                                item['quantity'],
                                item['currencyIndex'],				
                                item['tax'] / 2,
                                item['tax'] / 2,
                                item['isbn'],
                                branch_id
                            ]
                        )

            logger.info(f"Purchase created successfully with ID: {purchase_id}")
            return JsonResponse(
                {
                    'message': 'Purchase saved successfully',
                    'purchase_no': purchase_no,
                    'purchase_id': purchase_id,
                },
                status=201
            )

        except KeyError as e:
            logger.warning("Missing required field in create_purchase: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in create_purchase: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in create_purchase")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def get_sale_by_id(request, sale_id):
    if request.method == 'GET':
        try:
            sale_data = _get_sale_payload(sale_id=sale_id)
            if not sale_data:
                logger.warning(f"Sale not found: ID {sale_id}")
                return JsonResponse({'error': 'Sale not found'}, status=404)

            logger.info(f"Sale retrieved successfully: ID {sale_id}")
            return JsonResponse(sale_data, safe=False)

        except KeyError as e:
            logger.warning("Missing required field in get_sale_by_id (GET): %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in get_sale_by_id (GET): %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in get_sale_by_id (GET)")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    elif request.method == 'PUT':
        try:
            logger.debug(f"PUT request body: {request.body}")
            data = json.loads(request.body)

            required_fields = ['customer_nm', 'billing_address', 'sale_date',
                               'mobile_number', 'type', 'mode', 'class', 'cancel']
            for field in required_fields:
                if field not in data or data[field] is None or data[field] == '':
                    logger.error(f"Validation failed: Missing or null field: {field}")
                    return JsonResponse({'error': f'Missing or null field: {field}'}, status=400)

            optional_fields = {
                'bill_discount': 0.0,
                'bill_discount_amount': 0.0,
                'gross': 0.0,
                'round_off': 0.0,
                'bill_amount': 0.0,
                'note_1': '',
                'note_2': '',
                'freight_postage': 0.0,
                'processing_charge': 0.0
            }
            for field, default in optional_fields.items():
                data[field] = data.get(field, default) if data.get(field) is not None else default

            if not isinstance(data.get('items'), list) or not data['items']:
                logger.error("Validation failed: Items must be a non-empty list")
                return JsonResponse({'error': 'Items must be a non-empty list'}, status=400)

            sale_type_inverse = {v: k for k, v in sale_type_mapping.items()}
            class_type_inverse = {v: k for k, v in class_type_mapping.items()}

            try:
                type_code = sale_type_inverse[data['type']]
                mode_code = sale_mode_reverse_mapping[data['mode']]
                class_code = class_type_inverse[data['class']]
            except KeyError as e:
                logger.error(f"Invalid enum value for type/mode/class: {e}")
                return JsonResponse(
                    {'error': 'Invalid value for sale type, mode, or class.'},
                    status=400
                )

            cancel_raw = str(data['cancel']).strip().lower()
            cancel_code = 1 if cancel_raw in ('1', 'yes', 'y', 'true') else 0

            has_item_discount = any(float(item.get('discount', 0) or 0) > 0 for item in data['items'])
            bill_discount = float(data['bill_discount'] or 0)
            bill_discount_amount = float(data['bill_discount_amount'] or 0)

            discount_count = (
                (1 if has_item_discount else 0) +
                (1 if bill_discount > 0 else 0) +
                (1 if bill_discount_amount > 0 else 0)
            )
            if discount_count > 1:
                logger.error("Validation failed: Only one of item discount, bill discount %, or bill discount amount can be applied")
                return JsonResponse(
                    {'error': 'Only one of item discount, bill discount %, or bill discount amount can be applied'},
                    status=400
                )

            try:
                gross = float(data['gross'] or 0.0)
                round_off = float(data['round_off'] or 0.0)
                bill_amount = float(data['bill_amount'] or 0.0)

                # NEW: normalize ids
                customer_id = int(data.get('customer_id') or 0)
                branch_id = int(data.get('branch_id') or 0)
                agent_id = int(data.get('agent_id') or 0)

                # use same logic as create_sale: only credit sale keeps cr_customer_id
                if type_code != 0:
                    customer_id = 0

                for item in data['items']:
                    required_item_fields = ['itemName', 'quantity', 'exchangeRate', 'rate',
                                            'value', 'currency', 'currencyIndex', 'titleId']
                    for field in required_item_fields:
                        if field not in item or item[field] is None:
                            logger.error(f"Validation failed: Missing item field: {field}")
                            return JsonResponse({'error': f'Missing item field: {field}'}, status=400)

                    item['quantity'] = float(item['quantity'])
                    item['rate'] = float(item['rate'])
                    item['exchangeRate'] = float(item['exchangeRate'])
                    item['tax'] = float(item.get('tax') or 0.0)
                    item['discount'] = float(item.get('discount') or 0.0)
                    item['value'] = float(item['value'])
                    item['currencyIndex'] = int(item['currencyIndex'])
                    item['titleId'] = int(item['titleId'])
                    item['allocatedBillDiscount'] = float(item.get('allocatedBillDiscount', 0.0))
                    item['purchaseItemId'] = int(item.get('purchaseItemId') or 0)

            except (ValueError, TypeError) as e:
                logger.exception("Invalid data type")
                return JsonResponse({'error': 'Invalid data format.'}, status=400)

            total_value = sum(item['value'] for item in data['items'])
            for item in data['items']:
                item['allocatedBillDiscount'] = 0.0
                if not has_item_discount and total_value > 0:
                    if bill_discount > 0:
                        total_discount = gross * bill_discount / 100
                        item['allocatedBillDiscount'] = (item['value'] / total_value) * total_discount
                    elif bill_discount_amount > 0:
                        item['allocatedBillDiscount'] = (item['value'] / total_value) * bill_discount_amount

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE sales
                       SET customer_nm = %s,
                           billing_address = %s,
                           sale_date = %s,
                           mobile_number = %s,
                           type = %s,
                           mode = %s,
                           class = %s,
                           cancel = %s,
                           bill_discount = %s,
                           bill_discount_amount = %s,
                           gross = %s,
                           round_off = %s,
                           bill_amount = %s,
                           note_1 = %s,
                           note_2 = %s,
                           freight_postage = %s,
                           processing_charge = %s,
                           cr_customer_id = %s,
                           branch_id = %s,
                           agent_id = %s
                     WHERE id = %s
                    """,
                    [
                        data['customer_nm'],
                        data['billing_address'],
                        data['sale_date'],
                        data['mobile_number'],
                        type_code,
                        mode_code,
                        class_code,
                        cancel_code,
                        bill_discount,
                        bill_discount_amount,
                        gross,
                        round_off,
                        bill_amount,
                        data['note_1'],
                        data['note_2'],
                        float(data['freight_postage'] or 0.0),
                        float(data['processing_charge'] or 0.0),
                        customer_id,  # NEW: cr_customer_id
                        int(data.get('branch_id') or 0),    # NEW
                        int(data.get('agent_id') or 0),     # NEW
                        sale_id,
                    ]
                )

                cursor.execute("DELETE FROM sale_items WHERE sale_id = %s", [sale_id])

                for item in data['items']:
                    cursor.execute(
                        """
                        INSERT INTO sale_items (sale_id, exchange_rate, quantity, rate, tax, discount_p, line_value, currency_id, title_id, 
                                                allocated_bill_discount, purchase_company_id, purchase_id, purchase_item_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            sale_id,
                            item['exchangeRate'],
                            item['quantity'],
                            item['rate'],
                            item['tax'],
                            item['discount'],
                            item['value'],
                            item['currencyIndex'],
                            item['titleId'],
                            item['allocatedBillDiscount'],
                            item['purchaseCompanyId'],
                            item['purchaseId'],
                            item['purchaseItemId'],
                        ]
                    )

            logger.info(f"Sale updated successfully: ID {sale_id}")
            return JsonResponse({'message': 'Sale updated successfully'}, status=200)

        except KeyError as e:
            logger.warning("Missing required field in get_sale_by_id (PUT): %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in get_sale_by_id (PUT): %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in get_sale_by_id (PUT)")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_sale_by_bill_no(request):
    try:
        bill_no = (request.GET.get('bill_no') or '').strip()
        if not bill_no:
            return JsonResponse({'error': 'bill_no is required'}, status=400)

        company_id = _get_request_company_id(request)
        sale_data = _get_sale_payload(bill_no=bill_no, company_id=company_id)
        if not sale_data:
            logger.warning("Sale not found for bill_no %s in company %s", bill_no, company_id)
            return JsonResponse({'error': 'Sale not found'}, status=404)

        logger.info("Sale retrieved successfully for bill_no %s in company %s", bill_no, company_id)
        return JsonResponse(sale_data, safe=False)
    except ValueError as e:
        logger.warning("Invalid data in get_sale_by_bill_no: %s", e)
        return JsonResponse({'error': str(e)}, status=400)
    except Exception:
        logger.exception("Unexpected error in get_sale_by_bill_no")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)




@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def get_goods_inward_by_id(request, goods_inward_purchase_no):
    if request.method == 'GET':
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT P.entry_date, P.invoice_no, P.invoice_date, P.supplier_id, P.nett, P.inward_type, P.transaction_type, P.notes, P.gross, 
                           P.p_breakup_id1, P.p_breakup_amount1, P.p_breakup_id2, P.p_breakup_amount2, P.p_breakup_id3, P.p_breakup_amount3, 
                           P.p_breakup_id4, P.p_breakup_amount4, P.user_id, P.branch_id, S.supplier_nm, A.name AS user_nm, B.branches_nm,
                           pb1.breakup_nm AS p_breakup_nm1, pb2.breakup_nm AS p_breakup_nm2, pb3.breakup_nm AS p_breakup_nm3, 
                           pb4.breakup_nm AS p_breakup_nm4, P.purchase_no, P.id
                      FROM purchase P JOIN suppliers S ON (P.supplier_id = S.id)
                                      JOIN accounts_customuser A ON (P.user_id = A.id)
                                      JOIN branches B ON (P.branch_id = B.id)
                                      LEFT JOIN purchase_breakups pb1 ON (p.p_breakup_id1 = pb1.id)  
                                      LEFT JOIN purchase_breakups pb2 ON (p.p_breakup_id2 = pb2.id)
                                      LEFT JOIN purchase_breakups pb3 ON (p.p_breakup_id3 = pb3.id)
                                      LEFT JOIN purchase_breakups pb4 ON (p.p_breakup_id4 = pb4.id)                
                     WHERE P.purchase_no = %s
                    """,
                    [goods_inward_purchase_no]
                )
                goods_inward_id = 0
                goods_inward = cursor.fetchone()
                if not goods_inward:
                    logger.warning(f"Goods Inward not found: ID {goods_inward_purchase_no}")
                    return JsonResponse({'error': 'Goods Inward not found'}, status=404)

                type_mapping = {0: 'Purchase', 1: 'Sale Or Return', 2: 'Consignment', 3: 'Own Titles', 4: 'Own Periodicals', 5: "Other`s Periodicals", 6: 'Stock Transfer'}
                goods_inward_data = {
                    'inward_date': goods_inward[0].isoformat() if goods_inward[0] else '',
                    'bill_no': goods_inward[1] or '',
                    'bill_date': goods_inward[2].isoformat() if goods_inward[2] else '',
                    'supplier_id': int(goods_inward[3]) if goods_inward[3] is not None else 0,
                    'nett': float(goods_inward[4]) if goods_inward[4] is not None else 0.0,
                    'is_cash': 'Yes' if goods_inward[5] == 1 else 'No',
                    'type': type_mapping.get(goods_inward[6], ''),
                    'notes': goods_inward[7] or '',
                    'gross': float(goods_inward[8]) if goods_inward[8] is not None else 0.0,
                    'p_breakup_id1': int(goods_inward[9]) if goods_inward[9] is not None else 0,
                    'p_breakup_amt1': float(goods_inward[10]) if goods_inward[10] is not None else 0.0,
                    'p_breakup_id2': int(goods_inward[11]) if goods_inward[11] is not None else 0,
                    'p_breakup_amt2': float(goods_inward[12]) if goods_inward[12] is not None else 0.0,
                    'p_breakup_id3': int(goods_inward[13]) if goods_inward[13] is not None else 0,
                    'p_breakup_amt3': float(goods_inward[14]) if goods_inward[14] is not None else 0.0,
                    'p_breakup_id4': int(goods_inward[15]) if goods_inward[15] is not None else 0,
                    'p_breakup_amt4': float(goods_inward[16]) if goods_inward[16] is not None else 0.0,
                    'user_id': int(goods_inward[17]) if goods_inward[17] is not None else 0,
                    'branches_id': int(goods_inward[18]) if goods_inward[18] is not None else 0,
                    'supplier_nm': goods_inward[19] or '',
                    'user_nm': goods_inward[20] or '',
                    'branches_nm': goods_inward[21] or '',
                    'p_breakup_nm1': goods_inward[22] if goods_inward[22] is not None else '',
                    'p_breakup_nm2': goods_inward[23] if goods_inward[23] is not None else '',
                    'p_breakup_nm3': goods_inward[24] if goods_inward[24] is not None else '',
                    'p_breakup_nm4': goods_inward[25] if goods_inward[25] is not None else '',
                    'purchase_no': int(goods_inward[26]) if goods_inward[26] is not None else 0,
                    'purchase_id': int(goods_inward[27]) if goods_inward[27] is not None else 0,
                    'items': []
                }
                goods_inward_id = int(goods_inward[27])

                cursor.execute(
                    """
                    SELECT CASE WHEN T.language_id = 1 THEN T.title_m ELSE T.title END AS item_name, PI.isbn, PI.quantity, PI.rate, PI.exchange_rate, 
                           C.currency_name, PI.cgst + PI.sgst AS tax, PI.discount_p, PI.discount_a, PI.title_id, PI.currency_id, T.language_id, PI.id
                      FROM purchase_items PI JOIN titles T ON (PI.title_id = T.id)
                                             JOIN currencies C ON (PI.currency_id = C.id)
                     WHERE PI.purchase_id = %s
                    """,
                    [goods_inward_id]
                )
                items = cursor.fetchall()
                for item in items:
                    goods_inward_data['items'].append({
                        'itemName': item[0] or '',
                        'isbn': item[1] or '',
                        'quantity': float(item[2]) if item[2] is not None else 0.0,
                        'purchaseRate': float(item[3]) if item[3] is not None else 0.0,
                        'exchangeRate': float(item[4]) if item[4] is not None else 0.0,
                        'currency': item[5] or '',
                        'tax': float(item[6]) if item[6] is not None else 0.0,
                        'discount': float(item[7]) if item[7] is not None else 0.0,
                        'discountAmount': float(item[8]) if item[8] is not None else 0.0,
                        'value': float(item[2] * item[3] * item[4] * (1 - item[7] / 100) * (1 + item[6] / 100)),
                        'titleId': int(item[9]) if item[9] is not None else 0,
                        'currencyIndex': int(item[10]) if item[10] is not None else 0,
                        'language': int(item[11]) if item[11] is not None else 0,
                        'itemId': int(item[12]) if item[12] is not None else 0
                    })

            logger.info(f"Goods Inward retrieved successfully: ID {goods_inward_id}")
            return JsonResponse(goods_inward_data, safe=False)

        except KeyError as e:
            logger.warning("Missing required field in get_goods_inward_by_id (GET): %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in get_goods_inward_by_id (GET): %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in get_goods_inward_by_id (GET)")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    elif request.method == 'PUT':
        try:
            logger.debug(f"PUT request body: {request.body}")
            data = json.loads(request.body)

            required_fields = ['supplier_id', 'bill_no', 'bill_date', 'user_id', 'branches_id']
            for field in required_fields:
                if field not in data or data[field] is None or data[field] == '':
                    logger.error(f"Validation failed: Missing or null field: {field}")
                    return JsonResponse({'error': f'Missing or null field: {field}'}, status=400)

            optional_fields = {
                'gross': 0.0,
                'nett': 0.0,
                'notes': '',
                'is_cash': 'No',
                'type': '',
                'days': 0,
                'discount_percent': 0.0,
                'p_breakup_id1': 0,
                'p_breakup_amt1': 0.0,
                'p_breakup_id2': 0,
                'p_breakup_amt2': 0.0,
                'p_breakup_id3': 0,
                'p_breakup_amt3': 0.0,
                'p_breakup_id4': 0,
                'p_breakup_amt4': 0.0
            }
            for field, default in optional_fields.items():
                data[field] = data.get(field, default) if data.get(field) is not None else default

            if not isinstance(data['items'], list) or not data['items']:
                logger.error("Validation failed: Items must be a non-empty list")
                return JsonResponse({'error': 'Items must be a non-empty list'}, status=400)

            try:
                logger.debug("GI update: entry_date=%s, srl_no=%s, id=%s", data.get('entry_date'), data.get('srl_no'), data.get('id'))
                gross = _coerce_float(data.get('gross'), 0.0)
                nett = _coerce_float(data.get('nett'), 0.0)
                p_breakup_id1 = _coerce_int(data.get('p_breakup_id1'), 0)
                p_breakup_amt1 = _coerce_float(data.get('p_breakup_amt1'), 0.0)
                p_breakup_id2 = _coerce_int(data.get('p_breakup_id2'), 0)
                p_breakup_amt2 = _coerce_float(data.get('p_breakup_amt2'), 0.0)
                p_breakup_id3 = _coerce_int(data.get('p_breakup_id3'), 0)
                p_breakup_amt3 = _coerce_float(data.get('p_breakup_amt3'), 0.0)
                p_breakup_id4 = _coerce_int(data.get('p_breakup_id4'), 0)
                p_breakup_amt4 = _coerce_float(data.get('p_breakup_amt4'), 0.0)
                days = _coerce_int(data.get('days'), 0)
                discount_percent = _coerce_float(data.get('discount_percent'), 0.0)
                for item in data['items']:
                    required_item_fields = ['itemName', 'isbn', 'quantity', 'purchaseRate', 'exchangeRate', 'currency', 'tax', 'discount', 'discountAmount', 'value', 'titleId', 'currencyIndex']
                    for field in required_item_fields:
                        if field not in item or item[field] is None:
                            logger.error(f"Validation failed: Missing item field: {field}")
                            return JsonResponse({'error': f'Missing item field: {field}'}, status=400)
                    item['quantity'] = float(item['quantity'])
                    item['purchaseRate'] = float(item['purchaseRate'])
                    item['exchangeRate'] = float(item['exchangeRate'])
                    item['tax'] = float(item['tax']) if item.get('tax') is not None else 0.0
                    item['discount'] = float(item['discount']) if item.get('discount') else 0.0
                    item['discountAmount'] = float(item['discountAmount']) if item.get('discountAmount') else 0.0
                    item['value'] = float(item['value'])
                    item['currencyIndex'] = int(item['currencyIndex'])
                    item['titleId'] = int(item['titleId'])
                    if 'itemId' in item and item['itemId']:
                        item['itemId'] = int(item['itemId'])
                    else:
                        item['itemId'] = 0
            except (ValueError, TypeError) as e:
                logger.exception("Invalid data type")
                return JsonResponse({'error': 'Invalid data format.'}, status=400)

            type_mapping = {'Purchase': 0, 'Sale Or Return': 1, 'Consignment': 2, 'Own Titles': 3, 'Own Periodicals': 4, "Other`s Periodicals": 5, 'Stock Transfer': 6}
            with connection.cursor() as cursor:
                goods_inward_id = int(data.get('id') or 0)
                if goods_inward_id <= 0:
                    cursor.execute(
                        "SELECT id FROM purchase WHERE purchase_no = %s",
                        [goods_inward_purchase_no]
                    )
                    row = cursor.fetchone()
                    if not row:
                        return JsonResponse({'error': 'Goods Inward not found'}, status=404)
                    goods_inward_id = int(row[0])

                cursor.execute(
                    """
                    UPDATE purchase
                    SET invoice_no = %s,
                        invoice_date = %s,
                        supplier_id = %s,
                        nett = %s,
                        inward_type = %s,
                        transaction_type = %s,
                        notes = %s,
                        gross = %s,
                        p_breakup_id1 = %s,
                        p_breakup_amount1 = %s,
                        p_breakup_id2 = %s,
                        p_breakup_amount2 = %s,
                        p_breakup_id3 = %s,
                        p_breakup_amount3 = %s,
                        p_breakup_id4 = %s,
                        p_breakup_amount4 = %s,
                        user_id = %s,
                        branch_id = %s
                    WHERE id = %s
                    """,
                    [
                        data['bill_no'],
                        data['bill_date'],
                        data['supplier_id'],
                        nett,
                        1 if data['is_cash'] == 'Yes' else 0,
                        type_mapping.get(data['type'], -1),
                        data['notes'],
                        gross,
                        p_breakup_id1,
                        p_breakup_amt1,
                        p_breakup_id2,
                        p_breakup_amt2,
                        p_breakup_id3,
                        p_breakup_amt3,
                        p_breakup_id4,
                        p_breakup_amt4,
                        data['user_id'],
                        data['branches_id'],
                        goods_inward_id
                    ]
                )

                cursor.execute("SELECT id FROM purchase_items WHERE purchase_id = %s", [goods_inward_id])
                existing_rows = {row[0] for row in cursor.fetchall()}
                payload_ids = set()

                for item in data['items']:
                    if item['itemId'] and item['itemId'] in existing_rows:
                        payload_ids.add(item['itemId'])
                        cursor.execute(
                            """
                            UPDATE purchase_items
                               SET title_id = %s,
                                   rate = %s,
                                   exchange_rate = %s,
                                   discount_p = %s,
                                   discount_a = %s,
                                   quantity = %s,
                                   closing = %s,
                                   currency_id = %s,
                                   sgst = %s,
                                   cgst = %s,
                                   isbn = %s
                             WHERE id = %s
                            """,
                            [
                                item['titleId'],
                                item['purchaseRate'],
                                item['exchangeRate'],
                                item['discount'],
                                item['discountAmount'],
                                item['quantity'],
                                item['quantity'],
                                item['currencyIndex'],
                                item['tax'] / 2,
                                item['tax'] / 2,
                                item['isbn'],
                                item['itemId']
                            ]
                        )
                    else:
                        cursor.execute(
                            """
                            INSERT INTO purchase_items (purchase_id, title_id, rate, exchange_rate, discount_p, discount_a, quantity, closing, currency_id, sgst, cgst, isbn)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            [
                                goods_inward_id,
                                item['titleId'],
                                item['purchaseRate'],
                                item['exchangeRate'],
                                item['discount'],
                                item['discountAmount'],
                                item['quantity'],
                                item['quantity'],
                                item['currencyIndex'],
                                item['tax'] / 2,
                                item['tax'] / 2,
                                item['isbn']
                            ]
                        )

                # delete only rows not present in payload
                ids_to_delete = existing_rows - payload_ids
                if ids_to_delete:
                    cursor.execute(
                        "DELETE FROM purchase_items WHERE purchase_id = %s AND id = ANY(%s)",
                        [goods_inward_id, list(ids_to_delete)]
                    )

            logger.info(f"Goods Inward updated successfully: ID {goods_inward_id}")
            return JsonResponse({'message': 'Goods Inward updated successfully'}, status=200)

        except KeyError as e:
            logger.warning("Missing required field in get_goods_inward_by_id (PUT): %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in get_goods_inward_by_id (PUT): %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.exception("Unexpected error in get_goods_inward_by_id (PUT)")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def product_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            if query.startswith('.'):
                search_query = query[1:]
                cursor.execute(
                    """
                    SELECT id, title, title_m, rate, language_id, tax
                      FROM titles
                     WHERE title_m ILIKE %s AND language_id = 1 AND title_m IS NOT NULL AND title_m !~ '^[[:space:]]*$'
                     LIMIT 10
                    """,
                    [f'%{search_query}%']
                )
            else:
                cursor.execute(
                    """
                    SELECT id, title, title_m, rate, language_id, tax
                      FROM titles
                     WHERE title ILIKE %s AND title IS NOT NULL AND title !~ '^[[:space:]]*$'
                     LIMIT 10
                    """,
                    [f'%{query}%']
                )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'title': row[1],
                'title_m': row[2] or '',
                'rate': float(row[3]) if row[3] is not None else 0.0,
                'language': row[4],
                'raw_title_m': row[2] or '',
                'tax': row[5]
            }
            for row in results
        ]
        logger.info(f"Product search query: {query}, results: {len(suggestions)}, sample: {suggestions[:2]}")
        return Response(suggestions, content_type='application/json; charset=utf-8')

    except KeyError as e:
        logger.warning("Missing required field in product_search: %s", e)
        return Response({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in product_search: %s", e)
        return Response({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in product_search")
        return Response({'error': 'An unexpected error occurred.'}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def batch_select(request):
    try:
        titleId = request.GET.get('titleId', '')
        if not titleId:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT S.supplier_nm, P.entry_date, PD.rate, PD.exchange_rate, C.currency_name, PD.sgst + PD.cgst AS tax, PD.discount_p, PD.closing, 
                       PD.origin_company_id AS purchase_company_id, PD.origin_purchase_id AS purchase_id, 
                       PD.origin_purchase_items_id AS purchase_item_id
                  FROM titles T JOIN purchase_items PD ON (T.id = PD.title_id)
                                JOIN purchase P ON (P.id = PD.purchase_id)
                                JOIN suppliers S ON (S.id = P.supplier_id)
                                JOIN currencies C ON (PD.currency_id = C.id)
                 WHERE PD.title_id = %s AND PD.closing > 0
                """,
                [titleId]
            )
            rows = cursor.fetchall()
            batchList = [
                {
                    'supplier': row[0],
                    'inwardDate': row[1].isoformat(),
                    'rate': float(row[2]),
                    'exchangeRate': float(row[3]),
                    'currency': row[4],
                    'tax': row[5],
                    'inwardDiscount': float(row[6]),
                    'stock': float(row[7]),
                    'purchaseCompanyId': int(row[8]),
                    'purchaseId': int(row[9]),
                    'purchaseItemId': int(row[10]),
                } for row in rows
            ]
            logger.info(f"Product: {titleId}, results: {len(batchList)}, sample: {batchList}")
        return Response(batchList, content_type='application/json; charset=utf-8')

    except KeyError as e:
        logger.warning("Missing required field in batch_select: %s", e)
        return Response({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in batch_select: %s", e)
        return Response({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in batch_select")
        return Response({'error': 'An unexpected error occurred.'}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def customer_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, customer_nm, address_1, address_2, city, telephone
                  FROM cr_customers
                 WHERE customer_nm ILIKE %s
                 LIMIT 25
                """,
                [f'{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'customer_nm': row[1],
                'address_1': row[2],
                'address_2': row[3],
                'city': row[4],
                'telephone': row[5]
            }
            for row in results
        ]
        logger.info(f"Customer search successful for query: {query}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in customer_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in customer_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in customer_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_search(request):

    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, supplier_nm
                  FROM suppliers
                 WHERE supplier_nm ILIKE %s
                 LIMIT 25
                """,
                [f'{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'supplier_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Supplier search successful for query: {query}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in supplier_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_search(request):

    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, "name"
                  FROM accounts_customuser
                 WHERE "name" ILIKE %s
                 LIMIT 25
                """,
                [f'{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'user_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"User search successful for query: {query}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in user_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in user_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in user_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def branches_search(request):

    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, branches_nm
                  FROM branches
                 WHERE branches_nm ILIKE %s
                 LIMIT 25
                """,
                [f'{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'branches_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Branches search successful for query: {query}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in branches search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in branches search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in branches search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def breakup_search(request):

    try:
        query = request.GET.get('q', '')
        if not query:
            return Response([])

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, breakup_nm
                  FROM purchase_breakups
                 WHERE breakup_nm ILIKE %s
                 LIMIT 25
                """,
                [f'{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'breakup_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Breakup search successful for query: {query}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in breakup search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in breakup search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in breakup search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_currencies(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, currency_name
                FROM currencies
                ORDER BY currency_name
                """
            )
            results = cursor.fetchall()
            currencies = [{'id': row[0], 'name': row[1]} for row in results]
            logger.info(f"Currencies retrieved: {currencies}")
            return Response(currencies)  # Use Response for structured JSON
    except KeyError as e:
        logger.warning("Missing required field in get_currencies: %s", e)
        return Response({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in get_currencies: %s", e)
        return Response({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in get_currencies")
        return Response({'error': 'An unexpected error occurred.'}, status=500)
    



@api_view(['GET'])
@permission_classes([IsAuthenticated])
def author_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, author_nm
                  FROM authors
                 WHERE author_nm ILIKE %s
              ORDER BY author_nm
                 LIMIT 10
                """,
                [f'%{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'author_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Author search query: {query}, results: {len(suggestions)}, sample: {suggestions[:2]}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in author_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def publisher_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, publisher_nm
                  FROM publishers
                 WHERE publisher_nm ILIKE %s
              ORDER BY publisher_nm
                 LIMIT 10
                """,
                [f'%{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'publisher_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Publisher search query: {query}, results: {len(suggestions)}, sample: {suggestions[:2]}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in publisher_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, category_nm
                  FROM categories
                 WHERE category_nm ILIKE %s
              ORDER BY category_nm
                 LIMIT 10
                """,
                [f'%{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'category_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Category search query: {query}, results: {len(suggestions)}, sample: {suggestions[:2]}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in category_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sub_category_search(request):
    try:
        query = request.GET.get('q', '')
        if not query:
            return JsonResponse([], safe=False)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, sub_category_nm
                  FROM sub_categories
                 WHERE sub_category_nm ILIKE %s
              ORDER BY sub_category_nm
                 LIMIT 10
                """,
                [f'%{query}%']
            )
            results = cursor.fetchall()

        suggestions = [
            {
                'id': row[0],
                'sub_category_nm': row[1]
            }
            for row in results
        ]
        logger.info(f"Sub-Category search query: {query}, results: {len(suggestions)}, sample: {suggestions[:2]}")
        return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

    except KeyError as e:
        logger.warning("Missing required field in sub_category_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_category_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_category_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

################### TITLE MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def title_create(request):
    try:
        data = request.data
        logger.info(f"Creating title with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO titles (
                    id, title, author_id, language_id, title_m, rate, stock, tax, isbn,
                    publisher_id, translator_id, category_id, sub_category_id, ro_level,
                    ro_quantity, dn_level, sap_code, location_id
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                [
                    data['id'],
                    data['title'],
                    data['author_id'],
                    data['language_id'],
                    data['title_m'],
                    data['rate'],
                    data['stock'],
                    data['tax'],
                    data['isbn'],
                    data['publisher_id'],
                    data['translator_id'],
                    data['category_id'],
                    data['sub_category_id'],
                    data['ro_level'],
                    data['ro_quantity'],
                    data['dn_level'],
                    data['sap_code'],
                    data['location_id']
                ]
            )
        return JsonResponse({'message': 'Title created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in title_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in title_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in title_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def title_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None

        if not paginate and len(query) < 2:
            return JsonResponse({'error': 'Query must be at least 2 characters'}, status=400)

        where_clause = ""
        where_params = []
        if query:
            where_clause = "WHERE t.title ILIKE %s"
            where_params.append(f"%{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                      FROM titles t
                      LEFT JOIN authors a ON t.author_id = a.id
                      LEFT JOIN publishers p ON t.publisher_id = p.id
                      LEFT JOIN authors tr ON t.translator_id = tr.id
                      LEFT JOIN categories c ON t.category_id = c.id
                      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
                      {where_clause}
                    """,
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT t.id, t.title, t.author_id, a.author_nm, t.language_id, t.title_m, t.rate, t.stock, t.tax, t.isbn,
                           t.publisher_id, p.publisher_nm, t.translator_id, tr.author_nm AS translator_nm, t.category_id, 
                           c.category_nm, t.sub_category_id, sc.sub_category_nm, t.ro_level, t.ro_quantity, t.dn_level, t.sap_code, 
                           t.location_id
                      FROM titles t
                      LEFT JOIN authors a ON t.author_id = a.id
                      LEFT JOIN publishers p ON t.publisher_id = p.id
                      LEFT JOIN authors tr ON t.translator_id = tr.id
                      LEFT JOIN categories c ON t.category_id = c.id
                      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
                      {where_clause}
                   ORDER BY t.title
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT t.id, t.title, t.author_id, a.author_nm, t.language_id, t.title_m, t.rate, t.stock, t.tax, t.isbn,
                           t.publisher_id, p.publisher_nm, t.translator_id, tr.author_nm AS translator_nm, t.category_id, 
                           c.category_nm, t.sub_category_id, sc.sub_category_nm, t.ro_level, t.ro_quantity, t.dn_level, t.sap_code, 
                           t.location_id
                      FROM titles t
                      LEFT JOIN authors a ON t.author_id = a.id
                      LEFT JOIN publishers p ON t.publisher_id = p.id
                      LEFT JOIN authors tr ON t.translator_id = tr.id
                      LEFT JOIN categories c ON t.category_id = c.id
                      LEFT JOIN sub_categories sc ON t.sub_category_id = sc.id
                      {where_clause}
                   ORDER BY t.title
                     LIMIT 50
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'title': row[1],
                'author_id': row[2],
                'author_nm': row[3] or '',
                'language_id': row[4],
                'title_m': row[5] or '',
                'rate': float(row[6]),
                'stock': float(row[7]),
                'tax': float(row[8]),
                'isbn': row[9] or '',
                'publisher_id': row[10],
                'publisher_nm': row[11] or '',
                'translator_id': row[12],
                'translator_nm': row[13] or '',
                'category_id': row[14],
                'category_nm': row[15] or '',
                'sub_category_id': row[16],
                'sub_category_nm': row[17] or '',
                'ro_level': row[18],
                'ro_quantity': row[19],
                'dn_level': row[20],
                'sap_code': row[21] or '',
                'location_id': row[22]
            }
            for row in results
        ]
        logger.info("Title load query")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in title_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in title_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in title_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def title_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating title id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE titles
                SET 
                    title = %s,
                    author_id = %s,
                    language_id = %s,
                    title_m = %s,
                    rate = %s,
                    stock = %s,
                    tax = %s,
                    isbn = %s,
                    publisher_id = %s,
                    translator_id = %s,
                    category_id = %s,
                    sub_category_id = %s,
                    ro_level = %s,
                    ro_quantity = %s,
                    dn_level = %s,
                    sap_code = %s,
                    location_id = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['title'],
                    data['author_id'],
                    data['language_id'],
                    data['title_m'],
                    data['rate'],
                    data['stock'],
                    data['tax'],
                    data['isbn'],
                    data['publisher_id'],
                    data['translator_id'],
                    data['category_id'],
                    data['sub_category_id'],
                    data['ro_level'],
                    data['ro_quantity'],
                    data['dn_level'],
                    data['sap_code'],
                    data['location_id'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Title with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Title updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in title_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in title_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in title_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def title_delete(request, id):
    try:
        logger.info(f"Deleting title id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM titles
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Title with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Title deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in title_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in title_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in title_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

################### AUTHOR MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def author_create(request):
    try:
        data = request.data
        logger.info(f"Creating author with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO authors (
                    id, author_nm, contact, mail_id, address1, address2, telephone, city
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                [
                    data['id'],
                    data['author_nm'],
                    data['contact'],
                    data['mail_id'],
                    data['address1'],
                    data['address2'],
                    data['telephone'],
                    data['city']
                ]
            )
        return JsonResponse({'message': 'Author created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in author_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def author_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE author_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM authors {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, author_nm, contact, mail_id, address1, address2, telephone, city
                      FROM authors
                      {where_clause}
                  ORDER BY author_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, author_nm, contact, mail_id, address1, address2, telephone, city
                      FROM authors
                      {where_clause}
                  ORDER BY author_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'author_nm': row[1],
                'contact': row[2] or '',
                'mail_id': row[3] or '',
                'address1': row[4] or '',
                'address2': row[5] or '',
                'telephone': row[6] or '',
                'city': row[7] or ''
            }
            for row in results
        ]
        logger.info("Author load query")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in author_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def authors_list(request):
    """Get all authors for dropdown selection"""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, author_nm
                  FROM authors
              ORDER BY author_nm
                """
            )
            results = cursor.fetchall()

        authors = [
            {
                'id': row[0],
                'author_nm': row[1] or ''
            }
            for row in results
        ]
        return JsonResponse(authors, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in authors_list: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in authors_list: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in authors_list")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def author_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating author id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE authors
                SET 
                    author_nm = %s,
                    contact = %s,
                    mail_id = %s,
                    address1 = %s,
                    address2 = %s,
                    telephone = %s,
                    city = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['author_nm'],
                    data['contact'],
                    data['mail_id'],
                    data['address1'],
                    data['address2'],
                    data['telephone'],
                    data['city'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Author with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Author updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in author_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def author_delete(request, id):
    try:
        logger.info(f"Deleting author id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM authors
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Author with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Author deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in author_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### PUBLISHER MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def publisher_create(request):
    try:
        data = request.data
        logger.info(f"Creating publisher with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO publishers (
                    id, publisher_nm, contact, own, email, address1, address2, telephone, city, max_discount_p
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                [
                    data['id'],
                    data['publisher_nm'],
                    data['contact'],
                    data['own'],
                    data['email'],
                    data['address1'],
                    data['address2'],
                    data['telephone'],
                    data['city'],
                    data['max_discount_p']
                ]
            )
        return JsonResponse({'message': 'Publisher created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in publisher_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def publisher_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE publisher_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM publishers {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, publisher_nm, contact, own, email, address1, address2, telephone, city, max_discount_p
                      FROM publishers
                      {where_clause}
                  ORDER BY publisher_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, publisher_nm, contact, own, email, address1, address2, telephone, city, max_discount_p
                      FROM publishers
                      {where_clause}
                  ORDER BY publisher_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'publisher_nm': row[1],
                'contact': row[2] or '',
                'own': row[3],
                'email': row[4] or '',
                'address1': row[5] or '',
                'address2': row[6] or '',
                'telephone': row[7] or '',
                'city': row[8] or '',
                'max_discount_p': float(row[9] or 0)
            }
            for row in results
        ]
        logger.info(f"Publisher search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in publisher_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def publisher_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating publisher id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE publishers
                SET 
                    publisher_nm = %s,
                    contact = %s,
                    own = %s,
                    email = %s,
                    address1 = %s,
                    address2 = %s,
                    telephone = %s,
                    city = %s,
                    max_discount_p = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['publisher_nm'],
                    data['contact'],
                    data['own'],
                    data['email'],
                    data['address1'],
                    data['address2'],
                    data['telephone'],
                    data['city'],
                    data['max_discount_p'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Publisher with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Publisher updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in publisher_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def publisher_delete(request, id):
    try:
        logger.info(f"Deleting publisher id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM publishers
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Publisher with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Publisher deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in publisher_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### SUUPLIER MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def supplier_create(request):
    try:
        data = request.data
        logger.info(f"Creating supplier with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO suppliers (
                    id, supplier_nm, address_1, address_2, city, telephone, email_id, debit, credit, gstin
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                [
                    data['id'],
                    data['supplier_nm'],
                    data['address_1'],
                    data['address_2'],
                    data['city'],
                    data['telephone'],
                    data['email_id'],
                    data['debit'],
                    data['credit'],
                    data['gstin']
                ]
            )
        return JsonResponse({'message': 'Supplier created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in supplier_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE supplier_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM suppliers {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, supplier_nm, address_1, address_2, city, telephone, email_id, debit, credit, gstin
                      FROM suppliers
                      {where_clause}
                  ORDER BY supplier_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, supplier_nm, address_1, address_2, city, telephone, email_id, debit, credit, gstin
                      FROM suppliers
                      {where_clause}
                  ORDER BY supplier_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'supplier_nm': row[1],
                'address_1': row[2] or '',
                'address_2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'email_id': row[6] or '',
                'debit': float(row[7]),
                'credit': float(row[8]),
                'gstin': row[9] or ''
            }
            for row in results
        ]
        logger.info("Supplier load query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in supplier_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def supplier_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating supplier id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE suppliers
                SET 
                    supplier_nm = %s,
                    address_1 = %s,
                    address_2 = %s,
                    city = %s,
                    telephone = %s,
                    email_id = %s,
                    debit = %s,
                    credit = %s,
                    gstin = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['supplier_nm'],
                    data['address_1'],
                    data['address_2'],
                    data['city'],
                    data['telephone'],
                    data['email_id'],
                    data['debit'],
                    data['credit'],
                    data['gstin'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Supplier with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Supplier updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in supplier_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def supplier_delete(request, id):
    try:
        logger.info(f"Deleting supplier id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM suppliers
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Supplier with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Supplier deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in supplier_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

################### CREDIT CUSTOMER MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def credit_customer_create(request):
    try:
        data = request.data
        logger.info(f"Creating credit customer with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO cr_customers (
                    id, customer_nm, address_1, address_2, city, telephone, email_id, debit, credit, credit_days, credit_limit, gstin, class
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                """,
                [
                    data['id'],
                    data['customer_nm'],
                    data['address_1'],
                    data['address_2'],
                    data['city'],
                    data['telephone'],
                    data['email_id'],
                    data['debit'],
                    data['credit'],
                    data['credit_days'],
                    data['credit_limit'],
                    data['gstin'],
                    data['class']
                ]
            )
        return JsonResponse({'message': 'Credit customer created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in credit_customer_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in credit_customer_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in credit_customer_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_customer_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE customer_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM cr_customers {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, customer_nm, address_1, address_2, city, telephone, email_id, debit, credit, credit_days, credit_limit, gstin, class
                      FROM cr_customers
                      {where_clause}
                  ORDER BY customer_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, customer_nm, address_1, address_2, city, telephone, email_id, debit, credit, credit_days, credit_limit, gstin, class
                      FROM cr_customers
                      {where_clause}
                  ORDER BY customer_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'customer_nm': row[1],
                'address_1': row[2] or '',
                'address_2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'email_id': row[6] or '',
                'debit': float(row[7] or 0),
                'credit': float(row[8] or 0),
                'credit_days': row[9],
                'credit_limit': float(row[10] or 0),
                'gstin': row[11] or '',
                'class': row[12]
            }
            for row in results
        ]
        logger.info(f"Credit customer search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in credit_customer_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in credit_customer_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in credit_customer_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def credit_customer_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating credit customer id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE cr_customers
                SET 
                    customer_nm = %s,
                    address_1 = %s,
                    address_2 = %s,
                    city = %s,
                    telephone = %s,
                    email_id = %s,
                    debit = %s,
                    credit = %s,
                    credit_days = %s,
                    credit_limit = %s,
                    gstin = %s,
                    class = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['customer_nm'],
                    data['address_1'],
                    data['address_2'],
                    data['city'],
                    data['telephone'],
                    data['email_id'],
                    data['debit'],
                    data['credit'],
                    data['credit_days'],
                    data['credit_limit'],
                    data['gstin'],
                    data['class'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Credit customer with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Credit customer updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in credit_customer_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in credit_customer_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in credit_customer_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def credit_customer_delete(request, id):
    try:
        logger.info(f"Deleting credit customer id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM cr_customers
                WHERE id = %s
                RETURNING id
                """,
                [id],
            )
            row = cursor.fetchone()
            if not row:
                return JsonResponse({'error': f'Credit customer with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Credit customer deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in credit_customer_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in credit_customer_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in credit_customer_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### CATEGORY MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def category_create(request):
    data = request.data or {}
    category_name = (data.get('category_nm') or '').strip()

    if not category_name:
        return JsonResponse({'error': 'Category name is required'}, status=400)

    try:
        logger.info(f"Creating category with data: {data}")

        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO categories (category_nm)
                VALUES (%s)
                RETURNING id
                """,
                [category_name]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Category created successfully', 'id': new_id}, status=201)
    except IntegrityError as e:
        error_text = str(e)
        if 'categories_pk' in error_text:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT setval(
                            pg_get_serial_sequence('public.categories', 'id'),
                            COALESCE((SELECT MAX(id) FROM public.categories), 0)
                        )
                        """
                    )
                    cursor.execute(
                        """
                        INSERT INTO categories (category_nm)
                        VALUES (%s)
                        RETURNING id
                        """,
                        [category_name]
                    )
                    new_id = cursor.fetchone()[0]
                return JsonResponse({'message': 'Category created successfully', 'id': new_id}, status=201)
            except IntegrityError as retry_error:
                retry_text = str(retry_error)
                if 'categories_unique' in retry_text:
                    return JsonResponse({'error': 'Category already exists'}, status=400)
                logger.error(f"Error in category_create retry: {retry_text}")
                return JsonResponse({'error': retry_text}, status=400)
        if 'categories_unique' in error_text:
            return JsonResponse({'error': 'Category already exists'}, status=400)
        logger.error(f"Error in category_create: {error_text}")
        return JsonResponse({'error': error_text}, status=400)
    except KeyError as e:
        logger.warning("Missing required field in category_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def categories_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE category_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM categories {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, category_nm
                      FROM categories
                      {where_clause}
                  ORDER BY category_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, category_nm
                      FROM categories
                      {where_clause}
                  ORDER BY category_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'category_nm': row[1] or ''
            }
            for row in results
        ]
        logger.info(f"Category load query")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in categories_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in categories_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in categories_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def category_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating category id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE categories
                SET 
                    category_nm = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['category_nm'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Category with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Category updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in category_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def category_delete(request, id):
    try:
        logger.info(f"Deleting category id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM categories
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Category with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Category deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in category_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### SUB CATEGORY MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sub_category_create(request):
    try:
        data = request.data
        logger.info(f"Creating sub-category with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO sub_categories (sub_category_nm)
                VALUES (%s)
                RETURNING id
                """,
                [data['sub_category_nm']]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Sub-category created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in sub_category_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_category_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_category_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sub_categories_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE sub_category_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM sub_categories {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, sub_category_nm
                      FROM sub_categories
                      {where_clause}
                  ORDER BY sub_category_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, sub_category_nm
                      FROM sub_categories
                      {where_clause}
                  ORDER BY sub_category_nm    
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'sub_category_nm': row[1] or ''
            }
            for row in results
        ]
        logger.info(f"Sub-category search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in sub_categories_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_categories_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_categories_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def sub_category_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating sub-category id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE sub_categories
                SET 
                    sub_category_nm = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['sub_category_nm'],
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Sub-category with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Sub-category updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sub_category_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_category_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_category_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def sub_category_delete(request, id):
    try:
        logger.info(f"Deleting sub-category id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM sub_categories
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Sub-category with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Sub-category deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sub_category_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_category_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_category_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### PP CUSTOMERS MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pp_customer_create(request):
    try:
        data = request.data
        company_id = _get_request_company_id(request)
        logger.info(f"Creating PP customer with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO pp_customers (pp_customer_nm, address1, address2, city, telephone, contact, email, company_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    data['pp_customer_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email'),
                    company_id
                ]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'PP customer created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in pp_customer_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_customer_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_customer_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_customers_master_search(request):
    try:
        company_id = _get_request_company_id(request)
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = "WHERE company_id = %s"
        where_params = [company_id]

        if query:
            where_clause += " AND pp_customer_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM pp_customers {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, pp_customer_nm, address1, address2, city, telephone, contact, email
                      FROM pp_customers
                      {where_clause}
                  ORDER BY pp_customer_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, pp_customer_nm, address1, address2, city, telephone, contact, email
                      FROM pp_customers
                      {where_clause}
                  ORDER BY pp_customer_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'pp_customer_nm': row[1] or '',
                'address1': row[2] or '',
                'address2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'contact': row[6] or '',
                'email': row[7] or ''
            }
            for row in results
        ]
        logger.info(f"PP customer search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in pp_customers_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_customers_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_customers_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def pp_customer_update(request, id):
    try:
        data = request.data
        company_id = _get_request_company_id(request)
        logger.info(f"Updating PP customer id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE pp_customers
                SET 
                    pp_customer_nm = %s,
                    address1 = %s,
                    address2 = %s,
                    city = %s,
                    telephone = %s,
                    contact = %s,
                    email = %s
                WHERE id = %s AND company_id = %s
                RETURNING id
                """,
                [
                    data['pp_customer_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email'),
                    id,
                    company_id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'PP customer with id {id} not found'}, status=404)
        return JsonResponse({'message': 'PP customer updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in pp_customer_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_customer_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_customer_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def pp_customer_delete(request, id):
    try:
        company_id = _get_request_company_id(request)
        logger.info(f"Deleting PP customer id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM pp_customers
                WHERE id = %s AND company_id = %s
                RETURNING id
                """,
                [id, company_id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'PP customer with id {id} not found'}, status=404)
        return JsonResponse({'message': 'PP customer deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in pp_customer_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_customer_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_customer_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
   
################### PRIVILEGERS MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def privileger_create(request):
    try:
        data = request.data
        logger.info(f"Creating privileger with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO privilegers (privileger_nm, address1, address2, city, telephone, contact, email)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    data['privileger_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email')
                ]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Privileger created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in privileger_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in privileger_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in privileger_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def privilegers_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE privileger_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM privilegers {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, privileger_nm, address1, address2, city, telephone, contact, email
                      FROM privilegers
                      {where_clause}
                  ORDER BY privileger_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, privileger_nm, address1, address2, city, telephone, contact, email
                      FROM privilegers
                      {where_clause}
                  ORDER BY privileger_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'privileger_nm': row[1] or '',
                'address1': row[2] or '',
                'address2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'contact': row[6] or '',
                'email': row[7] or ''
            }
            for row in results
        ]
        logger.info(f"Privileger search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in privilegers_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in privilegers_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in privilegers_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def privileger_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating privileger id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE privilegers
                SET 
                    privileger_nm = %s,
                    address1 = %s,
                    address2 = %s,
                    city = %s,
                    telephone = %s,
                    contact = %s,
                    email = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['privileger_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email'),
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Privileger with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Privileger updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in privileger_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in privileger_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in privileger_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def privileger_delete(request, id):
    try:
        logger.info(f"Deleting privileger id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM privilegers
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Privileger with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Privileger deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in privileger_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in privileger_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in privileger_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### AGENTS MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_create(request):
    try:
        data = request.data
        logger.info(f"Creating agent with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO agents (agent_nm, address1, address2, city, telephone, contact, email)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    data['agent_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email')
                ]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Agent created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in agent_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in agent_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in agent_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def agents_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE agent_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM agents {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, agent_nm, address1, address2, city, telephone, contact, email
                      FROM agents
                      {where_clause}
                  ORDER BY agent_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, agent_nm, address1, address2, city, telephone, contact, email
                      FROM agents
                      {where_clause}
                  ORDER BY agent_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'agent_nm': row[1] or '',
                'address1': row[2] or '',
                'address2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'contact': row[6] or '',
                'email': row[7] or ''
            }
            for row in results
        ]
        logger.info(f"Agent search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in agents_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in agents_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in agents_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def agent_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating agent id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE agents
                SET 
                    agent_nm = %s,
                    address1 = %s,
                    address2 = %s,
                    city = %s,
                    telephone = %s,
                    contact = %s,
                    email = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['agent_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email'),
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Agent with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Agent updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in agent_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in agent_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in agent_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def agent_delete(request, id):
    try:
        logger.info(f"Deleting agent id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM agents
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Agent with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Agent deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in agent_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in agent_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in agent_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### ROYALTY RECIPENTS MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def royalty_recipient_create(request):
    try:
        data = request.data
        logger.info(f"Creating royalty recipient with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO royalty_recipients (royalty_recipient_nm, address1, address2, city, telephone, contact, email)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    data['royalty_recipient_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email')
                ]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Royalty recipient created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in royalty_recipient_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in royalty_recipient_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in royalty_recipient_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def royalty_recipients_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE royalty_recipient_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM royalty_recipients {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, royalty_recipient_nm, address1, address2, city, telephone, contact, email
                      FROM royalty_recipients
                      {where_clause}
                  ORDER BY royalty_recipient_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, royalty_recipient_nm, address1, address2, city, telephone, contact, email
                      FROM royalty_recipients
                      {where_clause}
                  ORDER BY royalty_recipient_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'royalty_recipient_nm': row[1] or '',
                'address1': row[2] or '',
                'address2': row[3] or '',
                'city': row[4] or '',
                'telephone': row[5] or '',
                'contact': row[6] or '',
                'email': row[7] or ''
            }
            for row in results
        ]
        logger.info(f"Royalty recipient search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in royalty_recipients_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in royalty_recipients_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in royalty_recipients_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def royalty_recipient_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating royalty recipient id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE royalty_recipients
                SET 
                    royalty_recipient_nm = %s,
                    address1 = %s,
                    address2 = %s,
                    city = %s,
                    telephone = %s,
                    contact = %s,
                    email = %s
                WHERE id = %s
                RETURNING id
                """,
                [
                    data['royalty_recipient_nm'],
                    data.get('address1'),
                    data.get('address2'),
                    data.get('city'),
                    data.get('telephone'),
                    data.get('contact'),
                    data.get('email'),
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Royalty recipient with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Royalty recipient updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in royalty_recipient_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in royalty_recipient_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in royalty_recipient_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def royalty_recipient_delete(request, id):
    try:
        logger.info(f"Deleting royalty recipient id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM royalty_recipients
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Royalty recipient with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Royalty recipient deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in royalty_recipient_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in royalty_recipient_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in royalty_recipient_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### PP BOOKS MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pp_book_create(request):
    try:
        data = request.data
        company_id = _get_request_company_id(request)
        logger.info(f"Creating PP book with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO pp_books (
                    company_id, code, nos, face_value, reg_start_date, reg_end_date, date_of_release, notes, closed, pp_book_firm_id, nos_ex, product_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, inserted, modified
                """,
                [
                    company_id,
                    data['code'],
                    data.get('nos'),
                    data.get('face_value'),
                    data.get('reg_start_date'),
                    data.get('reg_end_date'),
                    data.get('date_of_release'),
                    data.get('notes'),
                    data['closed'],
                    data['pp_book_firm_id'],
                    data['nos_ex'],
                    data['product_id']
                ]
            )
            row = cursor.fetchone()
            new_id, inserted, modified = row
        return JsonResponse({
            'message': 'PP book created successfully',
            'id': new_id,
            'inserted': inserted.isoformat() if inserted else None,
            'modified': modified.isoformat() if modified else None
        }, status=201)
    except KeyError as e:
        logger.warning("Missing required field in pp_book_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_book_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_book_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_books_master_search(request):
    try:
        company_id = _get_request_company_id(request)
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = "WHERE ppb.company_id = %s"
        where_params = [company_id]

        if query:
            where_clause += " AND t.title ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT COUNT(*)
                      FROM pp_books ppb
                      JOIN publishers p ON (ppb.pp_book_firm_id = p.id)
                      JOIN titles t ON (ppb.product_id = t.id)
                      {where_clause}
                    """,
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT ppb.id, t.title, ppb.code, ppb.nos, ppb.face_value, ppb.reg_start_date, ppb.reg_end_date, ppb.date_of_release, ppb.notes, ppb.closed,
                           ppb.pp_book_firm_id, ppb.nos_ex, ppb.product_id, p.publisher_nm, ppb.inserted, ppb.modified
                      FROM pp_books ppb
                      JOIN publishers p ON (ppb.pp_book_firm_id = p.id)
                      JOIN titles t ON (ppb.product_id = t.id)
                      {where_clause}
                  ORDER BY t.title
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT ppb.id, t.title, ppb.code, ppb.nos, ppb.face_value, ppb.reg_start_date, ppb.reg_end_date, ppb.date_of_release, ppb.notes, ppb.closed,
                           ppb.pp_book_firm_id, ppb.nos_ex, ppb.product_id, p.publisher_nm, ppb.inserted, ppb.modified
                      FROM pp_books ppb
                      JOIN publishers p ON (ppb.pp_book_firm_id = p.id)
                      JOIN titles t ON (ppb.product_id = t.id)
                      {where_clause}
                  ORDER BY t.title
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total
        suggestions = [
            {
                'id': row[0],
                'pp_book_nm': row[1] or '',
                'code': row[2] or '',
                'nos': row[3] if row[3] is not None else '',
                'face_value': float(row[4]) if row[4] is not None else '',
                'reg_start_date': row[5].isoformat() if row[5] else '',
                'reg_end_date': row[6].isoformat() if row[6] else '',
                'date_of_release': row[7].isoformat() if row[7] else '',
                'notes': row[8] or '',
                'closed': row[9] if row[9] is not None else '',
                'pp_book_firm_id': row[10] if row[10] is not None else '',
                'nos_ex': row[11] if row[11] is not None else '',
                'product_id': row[12] if row[12] is not None else '',
                'pp_book_firm': row[13] if row[13] is not None else '',
                'inserted': row[14].isoformat() if row[14] else '',
                'modified': row[15].isoformat() if row[15] else ''
            }
            for row in results
        ]
        logger.info("PP book load query")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in pp_books_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_books_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_books_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def pp_book_update(request, id):
    try:
        data = request.data
        company_id = _get_request_company_id(request)
        logger.info(f"Updating PP book id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE pp_books
                SET 
                    code = %s,
                    nos = %s,
                    face_value = %s,
                    reg_start_date = %s,
                    reg_end_date = %s,
                    date_of_release = %s,
                    notes = %s,
                    closed = %s,
                    pp_book_firm_id = %s,
                    nos_ex = %s,
                    product_id = %s,
                    modified = CURRENT_TIMESTAMP
                WHERE company_id = %s AND id = %s
                RETURNING id
                """,
                [
                    data['code'],
                    data.get('nos'),
                    data.get('face_value'),
                    data.get('reg_start_date'),
                    data.get('reg_end_date'),
                    data.get('date_of_release'),
                    data.get('notes'),
                    data['closed'],
                    data['pp_book_firm_id'],
                    data['nos_ex'],
                    data['product_id'],
                    company_id,
                    id
                ]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'PP book with id {id} not found'}, status=404)
        return JsonResponse({'message': 'PP book updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in pp_book_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_book_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_book_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def pp_book_delete(request, id):
    try:
        company_id = _get_request_company_id(request)
        logger.info(f"Deleting PP book id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM pp_books
                WHERE company_id = %s AND id = %s
                RETURNING id
                """,
                [company_id, id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'PP book with id {id} not found'}, status=404)
        return JsonResponse({'message': 'PP book deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in pp_book_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_book_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_book_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### PURCHASE BREASKUP MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def purchase_breakup_create(request):
    try:
        data = request.data
        logger.info(f"Creating purchase breakup with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO purchase_breakups (breakup_nm)
                VALUES (%s)
                RETURNING id
                """,
                [data['breakup_nm']]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Purchase breakup created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in purchase_breakup_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in purchase_breakup_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in purchase_breakup_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def purchase_breakups_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE breakup_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM purchase_breakups {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, breakup_nm
                      FROM purchase_breakups
                      {where_clause}
                  ORDER BY breakup_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, breakup_nm
                      FROM purchase_breakups
                      {where_clause}
                  ORDER BY breakup_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'breakup_nm': row[1] or ''
            }
            for row in results
        ]
        logger.info(f"Purchase breakup search query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in purchase_breakups_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in purchase_breakups_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in purchase_breakups_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def purchase_breakup_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating purchase breakup id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE purchase_breakups
                SET breakup_nm = %s
                WHERE id = %s
                RETURNING id
                """,
                [data['breakup_nm'], id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Purchase breakup with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Purchase breakup updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in purchase_breakup_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in purchase_breakup_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in purchase_breakup_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def purchase_breakup_delete(request, id):
    try:
        logger.info(f"Deleting purchase breakup id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM purchase_breakups
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Purchase breakup with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Purchase breakup deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in purchase_breakup_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in purchase_breakup_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in purchase_breakup_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### PLACES MASTER ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def place_create(request):
    try:
        data = request.data
        logger.info(f"Creating place with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO places (place_nm)
                VALUES (%s)
                RETURNING id
                """,
                [data['place_nm']]
            )
            new_id = cursor.fetchone()[0]
        return JsonResponse({'message': 'Place created successfully', 'id': new_id}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in place_create: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in place_create: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in place_create")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def places_master_search(request):
    try:
        query = (request.GET.get('q') or '').strip()
        page_param = request.GET.get('page')
        page_size_param = request.GET.get('page_size')
        paginate = page_param is not None or page_size_param is not None
        where_clause = ""
        where_params = []

        if query:
            where_clause = "WHERE place_nm ILIKE %s"
            where_params.append(f"{query}%")

        if paginate:
            try:
                page = int(page_param or 1)
            except (TypeError, ValueError):
                page = 1
            try:
                page_size = int(page_size_param or 100)
            except (TypeError, ValueError):
                page_size = 100

            page = max(page, 1)
            page_size = min(max(page_size, 1), 500)
            offset = (page - 1) * page_size

            with connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT COUNT(*) FROM places {where_clause}",
                    where_params
                )
                total = cursor.fetchone()[0] or 0
                cursor.execute(
                    f"""
                    SELECT id, place_nm
                      FROM places
                      {where_clause}
                  ORDER BY place_nm
                     LIMIT %s OFFSET %s
                    """,
                    [*where_params, page_size, offset]
                )
                results = cursor.fetchall()
        else:
            with connection.cursor() as cursor:
                cursor.execute(
                    f"""
                    SELECT id, place_nm
                      FROM places
                      {where_clause}
                  ORDER BY place_nm
                    """,
                    where_params
                )
                results = cursor.fetchall()
            total = len(results)
            page = 1
            page_size = total

        suggestions = [
            {
                'id': row[0],
                'place_nm': row[1] or ''
            }
            for row in results
        ]
        logger.info("Place load query.")

        if not paginate:
            return JsonResponse(suggestions, safe=False, json_dumps_params={'ensure_ascii': False})

        return JsonResponse(
            {
                'results': suggestions,
                'total': total,
                'page': page,
                'page_size': page_size
            },
            json_dumps_params={'ensure_ascii': False}
        )
    except KeyError as e:
        logger.warning("Missing required field in places_master_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in places_master_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in places_master_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def place_update(request, id):
    try:
        data = request.data
        logger.info(f"Updating place id={id} with data: {data}")
        
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE places
                SET place_nm = %s
                WHERE id = %s
                RETURNING id
                """,
                [data['place_nm'], id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Place with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Place updated successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in place_update: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in place_update: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in place_update")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def place_delete(request, id):
    try:
        logger.info(f"Deleting place id={id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM places
                WHERE id = %s
                RETURNING id
                """,
                [id]
            )
            if cursor.rowcount == 0:
                return JsonResponse({'error': f'Place with id {id} not found'}, status=404)
        return JsonResponse({'message': 'Place deleted successfully'}, status=200)
    except KeyError as e:
        logger.warning("Missing required field in place_delete: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in place_delete: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in place_delete")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    
################### GOODS INWARD RETURN ###################

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_search(request):
    """
    Search for suppliers by supplier_nm query.
    """
    try:
        query = request.GET.get('q', '')
        logger.debug(f"Supplier search query: q={query}")

        with connection.cursor() as cursor:
            sql_query = """
                SELECT id, supplier_nm
                FROM suppliers
                WHERE supplier_nm ILIKE %s
                LIMIT 10
            """
            cursor.execute(sql_query, [f'%{query}%'])
            results = cursor.fetchall()

            response = [{'id': row[0], 'supplier_nm': row[1]} for row in results]
            logger.info(f"Supplier search returned {len(response)} results")
            return JsonResponse(response, safe=False)

    except KeyError as e:
        logger.warning("Missing required field in supplier_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in supplier_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in supplier_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def purchase_search(request):
    """
    Search for purchase invoices by supplier_id and invoice_no query.
    """
    try:
        query = request.GET.get('q', '')
        supplier_id = request.GET.get('supplier_id', '')
        logger.debug(f"Purchase search query: q={query}, supplier_id={supplier_id}")

        with connection.cursor() as cursor:
            sql_query = """
                SELECT id, invoice_no, invoice_date
                  FROM purchase
                 WHERE supplier_id = %s AND invoice_no ILIKE %s
                 LIMIT 10
            """
            cursor.execute(sql_query, [supplier_id, f'%{query}%'])
            results = cursor.fetchall()

            response = [
                {
                    'id': row[0],
                    'invoice_no': row[1],
                    'invoice_date': row[2].isoformat() if row[2] else '',
                }
                for row in results
            ]
            logger.info(f"Purchase search returned {len(response)} results")
            return JsonResponse(response, safe=False)

    except KeyError as e:
        logger.warning("Missing required field in purchase_search: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in purchase_search: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in purchase_search")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_purchase_items_by_id(request, purchase_id):
    """
    Retrieve purchase items by purchase ID for the popup.
    """

    try:
        logger.debug(f"Fetching purchase items for purchase_id: {purchase_id}")
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT CASE WHEN T.language_id = 1 THEN T.title_m ELSE T.title END AS title,
                       PI.isbn,
                       PI.quantity,
                       PI.rate,
                       PI.exchange_rate,
                       C.currency_name,
                       PI.discount_p,
                       PI.discount_a,
                       PI.title_id,
                       PI.currency_id,
                       T.language_id,
                       PI.company_id AS origin_company_id,
                       PI.purchase_id AS origin_purchase_id,
                       PI.id AS origin_purchase_items_id
                  FROM purchase_items PI
                  JOIN titles T ON (PI.title_id = T.id)
                  JOIN currencies C ON (PI.currency_id = C.id)
                 WHERE PI.purchase_id = %s
                """,
                [purchase_id]
            )
            items = cursor.fetchall()

            # Keep response schema stable and numeric
            response = [
                {
                    'title': row[0] or '',
                    'isbn': row[1] or '',
                    'quantity': float(row[2]) if row[2] is not None else 0.0,
                    'rate': float(row[3]) if row[3] is not None else 0.0,
                    'exchange_rate': float(row[4]) if row[4] is not None else 1.0,
                    'currency_name': row[5] or 'Indian Rupees',
                    'discount_p': float(row[6]) if row[6] is not None else 0.0,
                    'discount_a': float(row[7]) if row[7] is not None else 0.0,
                    'title_id': int(row[8]) if row[8] is not None else 0,
                    'currency_id': int(row[9]) if row[9] is not None else 0,
                    'language_id': int(row[10]) if row[10] is not None else 0,
                    'origin_company_id': int(row[11]) if row[11] is not None else 0,
                    'origin_purchase_id': int(row[12]) if row[12] is not None else 0,
                    'origin_purchase_items_id': int(row[13]) if row[13] is not None else 0,
                }
                for row in items
            ]

            logger.info(f"Retrieved {len(response)} purchase items for purchase_id: {purchase_id}")
            return JsonResponse(response, safe=False)

    except KeyError as e:
        logger.warning("Missing required field in get_purchase_items_by_id: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in get_purchase_items_by_id: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in get_purchase_items_by_id")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

# ---------- helpers ----------
def _num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)

def _int(v, default=0):
    try:
        return int(v)
    except (TypeError, ValueError):
        return int(default)

def _str(v, default=''):
    return str(v).strip() if v is not None else default

def _fetch_one(cur, sql, params):
    cur.execute(sql, params)
    return cur.fetchone()

def resolve_supplier_id(cur, supplier_id=None, supplier_nm=None):
    """Prefer explicit id; else resolve by exact supplier_nm; else 0."""
    sid = None
    try:
        sid = int(supplier_id) if supplier_id not in (None, '') else None
    except Exception:
        sid = None

    if sid is not None:
        row = _fetch_one(cur, "SELECT id FROM suppliers WHERE id=%s", [sid])
        if row:
            return sid

    name = _str(supplier_nm, '')
    if name:
        row = _fetch_one(cur, "SELECT id FROM suppliers WHERE supplier_nm = %s", [name])
        if row:
            return _int(row[0], 0)

    return 0

def resolve_title_id(cur, item):
    """
    Try explicit title_id, else isbn, else title_m, else title.
    Accepts any dict with keys: title_id, isbn, title_m, title, itemName.
    Returns 0 if not found.
    """
    # explicit
    try:
        tid = int(item.get('title_id')) if item.get('title_id') not in (None, '') else None
    except Exception:
        tid = None
    if tid is not None:
        row = _fetch_one(cur, "SELECT id FROM titles WHERE id=%s", [tid])
        if row:
            return tid

    # by isbn
    isbn = _str(item.get('isbn'))
    if isbn:
        row = _fetch_one(cur, "SELECT id FROM titles WHERE isbn = %s", [isbn])
        if row:
            return _int(row[0], 0)

    # by title_m
    title_m = _str(item.get('title_m'))
    if not title_m:
        # some UIs carry the Malayalam title in 'itemName' or 'title'
        title_m = _str(item.get('itemName')) if item.get('language_id') == 1 else ''
    if title_m:
        row = _fetch_one(cur, "SELECT id FROM titles WHERE title_m = %s", [title_m])
        if row:
            return _int(row[0], 0)

    # by title
    title = _str(item.get('title')) or _str(item.get('itemName'))
    if title:
        row = _fetch_one(cur, "SELECT id FROM titles WHERE title = %s", [title])
        if row:
            return _int(row[0], 0)

    return 0


# ---------- endpoints ----------
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def goods_inward(request):
    try:
        data = request.data or {}
        pr = data.get('purchase_rt', {}) or {}
        rows = data.get('purchase_rt_items', []) or []

        branch_id_header = request.headers.get('X-Branch-Id')
        try:
            company_id = int(branch_id_header)
            if company_id <= 0:
                raise ValueError
        except (TypeError, ValueError):
            return JsonResponse({'error': 'Branch context missing. Please log in again.'}, status=400)

        with transaction.atomic():
            with connection.cursor() as cur:
                # resolve supplier id from id or supplier_nm
                supplier_id = resolve_supplier_id(
                    cur,
                    supplier_id=pr.get('supplier_id'),
                    supplier_nm=pr.get('supplier_nm'),
                )

                entry_date = _str(pr.get('entry_date')) or None  # let DB default if empty

                # lock for id allocation
                cur.execute("SELECT pg_advisory_xact_lock(%s, %s)", [company_id, 9001])

                # allocate next id per company
                cur.execute(
                    "SELECT COALESCE(MAX(id), 0) + 1 FROM purchase_rt WHERE company_id = %s",
                    [company_id],
                )
                parent_id = _int(cur.fetchone()[0], 1)

                # running number
                purchase_rt_no = get_next_value(company_id, '2526', 'PURCHASE_RT')

                # INSERT parent – note: NO bill_no here
                cur.execute(
                    """
                    INSERT INTO purchase_rt (company_id, id, purchase_rt_no, entry_date, nett, supplier_id, narration, pr_type, gross, 
                        inter_state, user_id)
                    VALUES (
                        %s, %s, %s, COALESCE(%s, CURRENT_DATE), %s, %s, %s, %s, %s, %s, %s
                    )
                    """,
                    [
                        company_id,
                        parent_id,
                        purchase_rt_no,
                        entry_date,
                        _num(pr.get('nett', 0)),
                        supplier_id,
                        _str(pr.get('narration', '.')) or '.',
                        _int(pr.get('pr_type', 0)),
                        _num(pr.get('gross', 0)),
                        _int(pr.get('inter_state', 0)),
                        _int(pr.get('user_id', 0)),
                    ],
                )

                # INSERT child rows
                child_id = 0
                for item in rows:
                    child_id += 1
                    title_id = resolve_title_id(cur, item)
                    currency_id = _int(item.get('currency_id', 0), 0)
                    purchase_company_id = _int(item.get('purchase_company_id', 0), 0)
                    purchase_id = _int(item.get('purchase_id', 0), 0)
                    purchase_det_id = _int(item.get('purchase_det_id', 0), 0)
                    cur.execute(
                        """
                        INSERT INTO purchase_rt_items (company_id, parent_id, id, title_id, quantity, rate, exchange_rate, adjusted_amount, 
                            discount, line_value, purchase_det_id, currency_id, purchase_company_id, purchase_id)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        [
                            company_id,
                            parent_id,
                            child_id,
                            title_id,
                            _num(item.get('quantity', 0.0)),
                            _num(item.get('rate', 0.0)),
                            _num(item.get('exchange_rate', 0.0)),
                            _num(item.get('adjusted_amount', 0.0)),
                            _num(item.get('discount', 0.0)),
                            _num(item.get('line_value', 0.0)),
                            purchase_det_id,
                            currency_id,
                            purchase_company_id,
                            purchase_id,
                        ],
                    )

        return JsonResponse(
            {
                'company_id': company_id,
                'id': parent_id,
                'purchase_rt_no': purchase_rt_no,
                'message': 'Goods inward created successfully',
            },
            status=201,
        )

    except KeyError as e:
        logger.warning("Missing required field in goods_inward: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in goods_inward: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in goods_inward")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)




@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def goods_inward_detail(request, id):
    # ---------- GET: load one purchase_rt + items ----------
    if request.method == 'GET':
        try:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT PR.company_id,
                           PR.id,
                           PR.purchase_rt_no,
                           PR.entry_date,
                           PR.nett,
                           PR.supplier_id,
                           COALESCE(S.supplier_nm, ''),
                           PR.narration,
                           PR.pr_type,
                           PR.gross,
                           PR.inter_state,
                           PR.user_id
                    FROM purchase_rt PR
                    LEFT JOIN suppliers S ON S.id = PR.supplier_id
                    WHERE PR.id = %s
                    """,
                    [id],
                )
                row = cur.fetchone()
                if not row:
                    return JsonResponse({'error': 'Goods inward not found'}, status=404)

                company_id = int(row[0])

                resp = {
                    'company_id': company_id,
                    'id': int(row[1]),
                    'purchase_rt_no': int(row[2]),
                    'entry_date': row[3].isoformat() if row[3] else None,
                    'nett': float(row[4]),
                    'supplier_id': int(row[5]),
                    'supplier_nm': row[6],
                    'narration': row[7] or '.',
                    'pr_type': int(row[8]),
                    'gross': float(row[9]),
                    'inter_state': int(row[10]),
                    'user_id': int(row[11]),
                }

                # items for that parent
                cur.execute(
                    """
                    SELECT PRI.id,
                           COALESCE(CASE WHEN T.language_id = 1 THEN T.title_m ELSE T.title END, '') AS title,
                           PRI.title_id,
                           PRI.quantity,
                           PRI.rate,
                           PRI.exchange_rate,
                           PRI.discount,
                           PRI.adjusted_amount,
                           PRI.line_value,
                           COALESCE(T.language_id, 0) AS language_id,
                           PRI.purchase_det_id,
                           PRI.currency_id,
                           COALESCE(C.currency_name, 'Indian Rupees') AS currency_name,
                           PRI.purchase_company_id,
                           PRI.purchase_id
                    FROM purchase_rt_items PRI
                    JOIN titles T ON T.id = PRI.title_id
                    LEFT JOIN currencies C ON C.id = PRI.currency_id
                    WHERE PRI.parent_id = %s
                    ORDER BY PRI.id
                    """,
                    [id],
                )

                rows = cur.fetchall()
                resp['items'] = [
                    {
                        'row_id': int(r[0]),
                        'title': r[1],
                        'title_id': int(r[2]),
                        'quantity': float(r[3]),
                        'rate': float(r[4]),
                        'exchange_rate': float(r[5]),
                        'discount': float(r[6]),
                        'adjusted_amount': float(r[7]),
                        'line_value': float(r[8]),
                        'language_id': int(r[9]),
                        'purchase_det_id': int(r[10]),
                        'currency_id': int(r[11]) if r[11] is not None else 0,
                        'currency_name': r[12] or 'Indian Rupees',
                        'purchase_company_id': int(r[13]) if r[13] is not None else 0,
                        'purchase_id': int(r[14]) if r[14] is not None else 0,
                        # UI extras (you hard-code these on FE)
                        'isbn': '',
                    }
                    for r in rows
                ]

                return JsonResponse(resp, status=200)

        except KeyError as e:
            logger.warning("Missing required field in request handler: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in request handler: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.error(f"Error in goods_inward_detail GET: {e}")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    # ---------- PUT: update purchase_rt + replace items ----------
    elif request.method == 'PUT':
        try:
            data = request.data or {}
            pr = data.get('purchase_rt', {}) or {}
            rows = data.get('purchase_rt_items', []) or []

            with transaction.atomic():
                with connection.cursor() as cur:
                    # make sure parent exists
                    cur.execute("SELECT company_id FROM purchase_rt WHERE id = %s", [id])
                    row = cur.fetchone()
                    if not row:
                        return JsonResponse({'error': 'Goods inward not found'}, status=404)

                    company_id = int(row[0])

                    # lock on (company_id, id) combo
                    cur.execute("SELECT pg_advisory_xact_lock(%s, %s)", [company_id, int(id)])

                    supplier_id = resolve_supplier_id(
                        cur,
                        pr.get('supplier_id'),
                        pr.get('supplier_nm'),
                    )

                    entry_date = pr.get('entry_date') or None

                    # update parent
                    cur.execute(
                        """
                        UPDATE purchase_rt
                           SET purchase_rt_no = %s,
                               entry_date     = COALESCE(%s, entry_date),
                               nett           = %s,
                               supplier_id    = %s,
                               narration      = %s,
                               pr_type        = %s,
                               gross          = %s,
                               inter_state    = %s,
                               user_id        = %s
                         WHERE id = %s
                        """,
                        [
                            int(pr.get('purchase_rt_no', 0)),
                            entry_date,
                            float(pr.get('nett', 0)),
                            supplier_id,
                            pr.get('narration', '.') or '.',
                            int(pr.get('pr_type', 0)),
                            float(pr.get('gross', 0)),
                            int(pr.get('inter_state', 0)),
                            int(pr.get('user_id', 0)),
                            int(id),
                        ],
                    )

                    cur.execute(
                        "SELECT id FROM purchase_rt_items WHERE parent_id = %s",
                        [int(id)],
                    )
                    existing_ids = {row[0] for row in cur.fetchall()}
                    payload_ids = set()
                    next_id = max(existing_ids) if existing_ids else 0

                    for item in rows:
                        row_id = _int(item.get('id') or item.get('row_id') or 0, 0)
                        title_id = resolve_title_id(cur, item)
                        currency_id = _int(item.get('currency_id', 0), 0)
                        purchase_company_id = _int(item.get('purchase_company_id', 0), 0)
                        purchase_id = _int(item.get('purchase_id', 0), 0)
                        purchase_det_id = _int(item.get('purchase_det_id', 0), 0)

                        if row_id in existing_ids:
                            payload_ids.add(row_id)
                            cur.execute(
                                """
                                UPDATE purchase_rt_items
                                   SET title_id = %s,
                                       quantity = %s,
                                       rate = %s,
                                       exchange_rate = %s,
                                       adjusted_amount = %s,
                                       discount = %s,
                                       line_value = %s,
                                       purchase_det_id = %s,
                                       currency_id = %s,
                                       purchase_company_id = %s,
                                       purchase_id = %s
                                 WHERE parent_id = %s AND id = %s
                                """,
                                [
                                    title_id,
                                    float(item.get('quantity', 0.0)),
                                    float(item.get('rate', 0.0)),
                                    float(item.get('exchange_rate', 0.0)),
                                    float(item.get('adjusted_amount', 0.0)),
                                    float(item.get('discount', 0.0)),
                                    float(item.get('line_value', 0.0)),
                                    purchase_det_id,
                                    currency_id,
                                    purchase_company_id,
                                    purchase_id,
                                    int(id),
                                    row_id,
                                ],
                            )
                        else:
                            if row_id <= 0:
                                next_id += 1
                                row_id = next_id
                            payload_ids.add(row_id)
                            cur.execute(
                                """
                                INSERT INTO purchase_rt_items (
                                    company_id,
                                    parent_id,
                                    id,
                                    title_id,
                                    quantity,
                                    rate,
                                    exchange_rate,
                                    adjusted_amount,
                                    discount,
                                    line_value,
                                    purchase_det_id,
                                    currency_id,
                                    purchase_company_id,
                                    purchase_id
                                )
                                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                """,
                                [
                                    company_id,
                                    int(id),
                                    row_id,
                                    title_id,
                                    float(item.get('quantity', 0.0)),
                                    float(item.get('rate', 0.0)),
                                    float(item.get('exchange_rate', 0.0)),
                                    float(item.get('adjusted_amount', 0.0)),
                                    float(item.get('discount', 0.0)),
                                    float(item.get('line_value', 0.0)),
                                    purchase_det_id,
                                    currency_id,
                                    purchase_company_id,
                                    purchase_id,
                                ],
                            )

                    # delete only rows that were removed
                    to_delete = existing_ids - payload_ids
                    if to_delete:
                        cur.execute(
                            "DELETE FROM purchase_rt_items WHERE parent_id = %s AND id = ANY(%s)",
                            [int(id), list(to_delete)],
                        )

            return JsonResponse(
                {
                    'company_id': company_id,
                    'id': int(id),
                    'message': 'Goods inward updated successfully',
                },
                status=200,
            )

        except KeyError as e:
            logger.warning("Missing required field in request handler: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in request handler: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            logger.error(f"Error in goods_inward_detail PUT: {e}")
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    # ---------- fallback (should never hit with api_view) ----------
    return JsonResponse({'error': 'Method not allowed'}, status=405)



################### SALE BILL RETURN ###################

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_rt_customers(request):
    """Distinct customers from sales.customer_nm, return id (min) + customer_nm."""
    q = (request.GET.get('q') or '').strip()
    try:
        with connection.cursor() as cur:
            if q:
                cur.execute(
                    """
                    SELECT MIN(id) AS id, customer_nm
                    FROM sales
                    WHERE customer_nm IS NOT NULL
                      AND customer_nm ILIKE %s
                    GROUP BY customer_nm
                    ORDER BY LOWER(customer_nm)
                    LIMIT 20
                    """,
                    [f"{q}%"],
                )
            else:
                cur.execute(
                    """
                    SELECT MIN(id) AS id, customer_nm
                    FROM sales
                    WHERE customer_nm IS NOT NULL
                    GROUP BY customer_nm
                    ORDER BY LOWER(customer_nm)
                    LIMIT 20
                    """
                )
            rows = cur.fetchall()
        return JsonResponse([{'id': r[0], 'customer_nm': r[1]} for r in rows], safe=False)
    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_rt_bills(request):
    """Bill suggestions for a selected customer; optional filter on bill_no."""
    customer = (request.GET.get('customer') or '').strip()
    q = (request.GET.get('q') or '').strip()
    if not customer:
        return JsonResponse([], safe=False)
    try:
        with connection.cursor() as cur:
            if q:
                cur.execute(
                    """
                    SELECT id, bill_no, sale_date
                    FROM sales
                    WHERE customer_nm = %s
                      AND bill_no ILIKE %s
                    ORDER BY id DESC
                    LIMIT 30
                    """,
                    [customer, f"{q}%"],
                )
            else:
                cur.execute(
                    """
                    SELECT id, bill_no, sale_date
                    FROM sales
                    WHERE customer_nm = %s
                    ORDER BY id DESC
                    LIMIT 30
                    """,
                    [customer],
                )
            rows = cur.fetchall()
        return JsonResponse(
            [{'id': r[0], 'bill_no': r[1], 'sale_date': r[2].isoformat() if r[2] else None} for r in rows],
            safe=False,
        )
    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_rt_bill_items(request, sale_id: int):
    """
    Items for a given sale id, including hidden IDs:
    - id (sale_items.id) => returned as 'id'
    - purchase_item_id
    Also includes computed dis_a as required.
    """
    try:
        with connection.cursor() as cur:
            cur.execute(
                """
                SELECT
                    si.id,
                    si.purchase_company_id,
                    si.purchase_id,
                    si.purchase_item_id,
                    si.title_id,
                    COALESCE(t.title, '') AS title,
                    si.quantity,
                    0.0::numeric AS r_qty,
                    si.rate,
                    COALESCE(c.currency_name, 'Indian Rupees') AS currency_name,
                    si.exchange_rate,
                    si.tax,
                    COALESCE(si.allocated_bill_discount, 0)
                      + ((COALESCE(si.rate,0) * COALESCE(si.exchange_rate,1) * COALESCE(si.quantity,0)) * COALESCE(si.discount_p,0))/100
                      AS dis_a,
                    si.line_value
                FROM sale_items si
                LEFT JOIN titles t ON t.id = si.title_id
                LEFT JOIN currencies c ON c.id = si.currency_id
                WHERE si.sale_id = %s
                ORDER BY si.id
                """,
                [sale_id],
            )
            rows = cur.fetchall()

        data = [
            {
                'id': r[0],
                'purchase_company_id': r[1],
                'purchase_id': r[2],
                'purchase_item_id': r[3],
                'title_id': r[4],
                'title': r[5],
                'quantity': float(r[6]),
                'r_qty': float(r[7]),
                'rate': float(r[8]),
                'currency_name': r[9],
                'exchange_rate': float(r[10]),
                'tax': float(r[11]),
                'dis_a': float(r[12]),
                'line_value': float(r[13]),
            }
            for r in rows
        ]
        return JsonResponse(data, safe=False)
    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sales_rt_create(request):
    from .views import sale_type_reverse_mapping, payment_type_reverse_mapping  # they already exist in your module

    data = request.data or {}
    header = data.get('header') or {}
    rows = data.get('items') or []

    if not header.get('date'):
        return JsonResponse({'error': 'entry_date is required'}, status=400)
    if not header.get('customer'):
        return JsonResponse({'error': 'customer is required'}, status=400)
    if not rows:
        return JsonResponse({'error': 'At least one item is required'}, status=400)

    branch_id_header = request.headers.get('X-Branch-Id')
    try:
        branch_id = int(branch_id_header)
        if branch_id <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return JsonResponse({'error': 'Branch context missing. Please log in again.'}, status=400)

    entry_date = header.get('date')
    s_type = sale_type_reverse_mapping.get(header.get('type'), 0)
    cash = payment_type_reverse_mapping.get(header.get('pay'), 0)
    customer_nm = header.get('customer')
    narration = header.get('notes') or None
    nett = _num(header.get('nett'), 0.0)
    discount_a = _num(header.get('amt'), 0.0)
    discount_p = _num(header.get('disP'), 0.0)

    # cr_customer_id lookup
    def _get_cr_customer_id():
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT id FROM cr_customers WHERE customer_nm = %s LIMIT 1", [customer_nm])
                r = cur.fetchone()
                return int(r[0]) if r else 0
        except Exception:
            return 0
        

    cr_customer_id = _get_cr_customer_id()
    sales_rt_no =  get_next_value(branch_id, '2526', 'SALE_RT')

    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                # insert header
                cur.execute(
                    """
                    INSERT INTO sales_rt (
                        company_id, sales_rt_no, entry_date, s_type, cash, cash_customer, narration, nett, gross, discount_a,
                        discount_p, rounded_off, user_id, cr_customer_id
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id
                    """,
                    [
                        branch_id,  # company_id
                        sales_rt_no,
                        entry_date,
                        s_type,
                        cash,
                        customer_nm or '.',
                        narration,
                        float(nett),
                        0.0,  # gross
                        float(discount_a),
                        float(discount_p),
                        0.0,  # rounded_off
                        0,    # user_id
                        cr_customer_id or None,
                    ],
                )
                parent_id = cur.fetchone()[0]

                # insert child rows
                for it in rows:
                    cur.execute(
                        """
                        INSERT INTO sale_rt_items (company_id, parent_id, title_id, quantity, rate, tax, exchange_rate, discount_p, discount_a, 
                            discount, sale_det_id, line_value, purchase_company_id, purchase_id, purchase_det_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [
                            branch_id,  # company_id
                            parent_id,
                            _int(it.get('title_id'), 0),
                            float(_num(it.get('qty'), 0.0)),
                            float(_num(it.get('rate'), 0.0)),
                            float(_num(it.get('tax'), 0.0)),
                            float(_num(it.get('exchange_rate'), 1.0)),
                            0.0,  # discount_p (as per requirement)
                            float(_num(it.get('discount_a'), 0.0)),
                            0.0,  # discount (as per requirement)
                            _int(it.get('sale_det_id'), 0),
                            float(_num(it.get('line_value'), 0.0)),
                            _int(it.get('purchase_company_id'), 0),
                            _int(it.get('purchase_id'), 0),
                            _int(it.get('purchase_det_id'), 0),
                        ],
                    )

        return JsonResponse({'id': parent_id, 'message': 'Sales return created successfully'}, status=201)
    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def sales_rt_detail(request, id: int):
    """Load/update/delete a sales return with items; map codes back to labels using your mappings."""
    from .views import sale_type_mapping, payment_type_mapping  # already declared in your module

    if request.method == 'GET':
        try:
            with connection.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, company_id, sales_rt_no, entry_date, s_type, cash, cash_customer, narration, nett, gross, discount_a, discount_p,
                           rounded_off, user_id, cr_customer_id
                    FROM sales_rt
                    WHERE id = %s
                    """,
                    [id],
                )
                hdr = cur.fetchone()
                if not hdr:
                    return JsonResponse({'error': 'Sales return not found'}, status=404)

                cur.execute(
                    """
                    SELECT
                        sri.title_id,
                        COALESCE(t.title, '') AS title,
                        sri.quantity,
                        sri.rate,
                        sri.tax,
                        sri.exchange_rate,
                        sri.discount_a,
                        sri.line_value,
                        sri.sale_det_id,
                        sri.purchase_company_id,
                        sri.purchase_id,
                        sri.purchase_det_id,
                        COALESCE(c.currency_name, 'Indian Rupees') AS currency_name
                    FROM sale_rt_items sri
                    LEFT JOIN titles t ON t.id = sri.title_id
                    LEFT JOIN sale_items si ON si.id = sri.sale_det_id
                    LEFT JOIN currencies c ON c.id = si.currency_id
                    WHERE sri.parent_id = %s
                    ORDER BY sri.id
                    """,
                    [id],
                )
                rows = cur.fetchall()

            s_type_label = sale_type_mapping.get(hdr[4], 'Credit Sale')
            cash_label = payment_type_mapping.get(hdr[5], 'Cash')

            data = {
                'id': hdr[0],
                'company_id': hdr[1],
                'sales_rt_no': hdr[2],
                'entry_date': hdr[3].isoformat() if hdr[3] else None,
                's_type': hdr[4],
                's_type_label': s_type_label,
                'cash': hdr[5],
                'cash_label': cash_label,
                'cash_customer': hdr[6] or '.',
                'narration': hdr[7],
                'nett': float(hdr[8] or 0),
                'gross': float(hdr[9] or 0),
                'discount_a': float(hdr[10] or 0),
                'discount_p': float(hdr[11] or 0),
                'rounded_off': float(hdr[12] or 0),
                'user_id': hdr[13],
                'cr_customer_id': hdr[14],
                'items': [
                    {
                        'title_id': r[0],
                        'title': r[1],
                        'quantity': float(r[2] or 0),
                        'rate': float(r[3] or 0),
                        'tax': float(r[4] or 0),
                        'exchange_rate': float(r[5] or 1),
                        'discount_a': float(r[6] or 0),
                        'line_value': float(r[7] or 0),
                        'sale_det_id': int(r[8] or 0),
                        'purchase_company_id': int(r[9] or 0),
                        'purchase_id': int(r[10] or 0),
                        'purchase_det_id': int(r[11] or 0),
                        'currency_name': r[12] or 'Indian Rupees',
                    }
                    for r in rows
                ],
            }
            return JsonResponse(data, safe=False)
        except KeyError as e:
            logger.warning("Missing required field in request handler: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in request handler: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    if request.method == 'PUT':
        data = request.data or {}
        header = data.get('header') or {}
        rows = data.get('items') or []

        if not header.get('date'):
            return JsonResponse({'error': 'entry_date is required'}, status=400)
        if not header.get('customer'):
            return JsonResponse({'error': 'customer is required'}, status=400)
        if not rows:
            return JsonResponse({'error': 'At least one item is required'}, status=400)

        entry_date = header.get('date')
        s_type = sale_type_reverse_mapping.get(header.get('type'), 0)
        cash = payment_type_reverse_mapping.get(header.get('pay'), 0)
        customer_nm = header.get('customer')
        narration = header.get('notes') or None
        nett = _num(header.get('nett'), 0.0)
        discount_a = _num(header.get('amt'), 0.0)
        discount_p = _num(header.get('disP'), 0.0)
        header_no = header.get('no')

        # cr_customer_id lookup
        def _get_cr_customer_id():
            try:
                with connection.cursor() as cur:
                    cur.execute("SELECT id FROM cr_customers WHERE customer_nm = %s LIMIT 1", [customer_nm])
                    r = cur.fetchone()
                    return int(r[0]) if r else 0
            except Exception:
                return 0

        cr_customer_id = _get_cr_customer_id()

        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute("SELECT sales_rt_no FROM sales_rt WHERE id = %s", [id])
                    row = cur.fetchone()
                    if not row:
                        return JsonResponse({'error': 'Sales return not found'}, status=404)

                    existing_no = int(row[0] or 0)
                    sales_rt_no = existing_no
                    if header_no not in (None, ''):
                        sales_rt_no = _int(header_no, existing_no)

                    cur.execute(
                        """
                        UPDATE sales_rt
                           SET sales_rt_no   = %s,
                               entry_date    = %s,
                               s_type        = %s,
                               cash          = %s,
                               cash_customer = %s,
                               narration     = %s,
                               nett          = %s,
                               discount_a    = %s,
                               discount_p    = %s,
                               cr_customer_id = %s
                         WHERE id = %s
                        """,
                        [
                            sales_rt_no,
                            entry_date,
                            s_type,
                            cash,
                            customer_nm or '.',
                            narration,
                            float(nett),
                            float(discount_a),
                            float(discount_p),
                            cr_customer_id or None,
                            int(id),
                        ],
                    )

                    cur.execute("DELETE FROM sale_rt_items WHERE parent_id = %s", [int(id)])

                    for it in rows:
                        cur.execute(
                            """
                            INSERT INTO sale_rt_items (
                                company_id,
                                parent_id,
                                title_id,
                                quantity,
                                rate,
                                tax,
                                exchange_rate,
                                discount_p,
                                discount_a,
                                discount,
                                sale_det_id,
                                line_value,
                                purchase_company_id,
                                purchase_id,
                                purchase_det_id
                            )
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                            """,
                            [
                                0,
                                int(id),
                                _int(it.get('title_id'), 0),
                                float(_num(it.get('qty'), 0.0)),
                                float(_num(it.get('rate'), 0.0)),
                                float(_num(it.get('tax'), 0.0)),
                                float(_num(it.get('exchange_rate'), 1.0)),
                                0.0,
                                float(_num(it.get('discount_a'), 0.0)),
                                0.0,
                                _int(it.get('sale_det_id'), 0),
                                float(_num(it.get('line_value'), 0.0)),
                                _int(it.get('purchase_company_id'), 0),
                                _int(it.get('purchase_id'), 0),
                                _int(it.get('purchase_det_id'), 0),
                            ],
                        )

            return JsonResponse({'id': int(id), 'message': 'Sales return updated successfully'}, status=200)
        except KeyError as e:
            logger.warning("Missing required field in request handler: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in request handler: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    if request.method == 'DELETE':
        try:
            with transaction.atomic():
                with connection.cursor() as cur:
                    cur.execute("DELETE FROM sale_rt_items WHERE parent_id = %s", [int(id)])
                    cur.execute("DELETE FROM sales_rt WHERE id = %s", [int(id)])
                    if cur.rowcount == 0:
                        return JsonResponse({'error': 'Sales return not found'}, status=404)
            return JsonResponse({'message': 'Sales return deleted successfully'}, status=200)
        except KeyError as e:
            logger.warning("Missing required field in request handler: %s", e)
            return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
        except (ValueError, TypeError) as e:
            logger.warning("Invalid data format in request handler: %s", e)
            return JsonResponse({'error': 'Invalid data format.'}, status=400)
        except Exception:
            return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

    return JsonResponse({'error': 'Method not allowed'}, status=405)
    
################### P P RECEIPT ENTRY ###################

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pp_receipts_iud(request):
    try:
        d = request.data or {}
        company_id = _get_request_company_id(request)

        # Prepare Python-side sanitization for tricky fields
        pin_char = (d.get('pin') or '')
        pin_char = pin_char[:1] if pin_char else None  # procedure expects char(1)
        which = (d.get('which') or 'I')[:1]            # char(1)
        pp_book_id = d.get('pp_book_id')        

        with transaction.atomic():
            with connection.cursor() as cur:
                reg_no = d.get('reg_no')
                p_receipt_no = d.get('receipt_no')
                p_r_type = d.get('r_type')
                logger.debug("pp_receipts_iud: r_type=%s", p_r_type)

                p_pp_customer_book_id = d.get('pp_customer_book_id')
                if p_r_type in (0, 1):
                    p_pp_customer_book_id = get_next_value(company_id, '0000', 'PP_CSBK_ID')
                p_receipt_no = get_next_value(company_id, '2526', 'PP_RCPT_NO')
                if which == 'I' and pp_book_id:
                    # Atomically increment and fetch the *new* code & nos
                    cur.execute(
                        """
                        UPDATE pp_books
                           SET nos = nos + 1
                         WHERE company_id = %s AND id = %s
                        RETURNING code, nos
                        """,
                        [company_id, pp_book_id]
                    )
                    row = cur.fetchone()
                    if not row:
                        raise Exception("PP Book not found for given company_id and pp_book_id..!")

                    code, nos = row
                    # You wrote '_' in the comment but example shows 'TBC-201'.
                    # Using hyphen to match your example. Change to '_' if you prefer.
                    reg_no = f"{code}-{nos}"

                query = """
                    CALL public.pp_receipts_insert_update_delete(
                        CAST(%s AS smallint),  -- p_company_id
                        CAST(%s AS integer),   -- p_id
                        CAST(%s AS integer),   -- p_receipt_no
                        CAST(%s AS date),      -- p_entry_date
                        CAST(%s AS smallint),  -- p_customer_id
                        CAST(%s AS integer),   -- p_pp_customer_id
                        CAST(%s AS numeric),   -- p_amount
                        CAST(%s AS varchar),   -- p_name
                        CAST(%s AS varchar),   -- p_address1
                        CAST(%s AS varchar),   -- p_address2
                        CAST(%s AS smallint),  -- p_r_type
                        CAST(%s AS smallint),  -- p_a_type
                        CAST(%s AS varchar),   -- p_bank
                        CAST(%s AS varchar),   -- p_chq_dd_no
                        CAST(%s AS varchar),   -- p_reg_no
                        CAST(%s AS smallint),  -- p_pp_book_id
                        CAST(%s AS varchar),   -- p_installments
                        CAST(%s AS varchar),   -- p_note1
                        CAST(%s AS smallint),  -- p_copies
                        CAST(%s AS smallint),  -- p_agent_id
                        CAST(%s AS varchar),   -- p_city
                        CAST(%s AS char),      -- p_pin (char(1))
                        CAST(%s AS varchar),   -- p_telephone
                        CAST(%s AS smallint),  -- p_exhibition_id
                        CAST(%s AS smallint),  -- p_user_id
                        CAST(%s AS integer),   -- p_pp_customer_book_id
                        CAST(%s AS char)       -- p_which (char(1))
                    )
                """
                params = [
                    company_id,
                    d.get('id'),
                    p_receipt_no,
                    d.get('entry_date'),
                    d.get('customer_id'),
                    d.get('pp_customer_id'),
                    d.get('amount'),
                    d.get('name'),
                    d.get('address1'),
                    d.get('address2'),
                    d.get('r_type'),
                    d.get('a_type'),
                    d.get('bank'),
                    d.get('chq_dd_no'),
                    reg_no,
                    d.get('pp_book_id'),
                    d.get('installments'),
                    d.get('note1'),
                    d.get('copies'),
                    d.get('agent_id'),
                    d.get('city'),
                    pin_char,
                    d.get('telephone'),
                    d.get('exhibition_id'),
                    d.get('user_id') or getattr(request.user, 'id', None),
                    p_pp_customer_book_id,
                    which,
                ]
                
                if logger.isEnabledFor(logging.DEBUG):
                    full_sql = cur.mogrify(query, params).decode('utf-8')
                    logger.debug("Executing Procedure: %s", full_sql)
                
                cur.execute(query, params)

        return JsonResponse({'message': 'PP receipt processed successfully', 'which': which}, status=200)

    except KeyError as e:
        logger.warning("Missing required field in pp_receipts_iud: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in pp_receipts_iud: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in pp_receipts_iud")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_receipt_by_no(request):
    """
    Load a single receipt by its receipt_no. Returns joined fields so the UI can fill everything.
    """
    try:
        company_id = _get_request_company_id(request)
        receipt_no = request.GET.get('receipt_no', '').strip()
        if not receipt_no:
            return JsonResponse({'error': 'receipt_no is required'}, status=400)

        with connection.cursor() as cur:
            cur.execute("""
                SELECT
                    r.id,
                    r.company_id,
                    r.receipt_no,
                    r.entry_date,
                    r.pp_customer_id,
                    r.amount,
                    r.r_type,
                    r.a_type,
                    r.bank,
                    r.chq_dd_no,
                    r.installments,
                    r.note1,
                    r.pp_book_id,
                    r.customer_id,
                    r.agent_id,
                    r.exhibition_id,
                    r.user_id,
                    pcb.copies,
                    pcb.reg_no,
                    c.pp_customer_nm,
                    c.address1,
                    c.address2,
                    c.city,
                    c.pin,
                    c.telephone,
                    a.agent_nm,
                    t.title,
                    r.pp_customer_book_id
                FROM pp_receipts r
                LEFT JOIN pp_customers c
                  ON c.id = r.pp_customer_id
                LEFT JOIN pp_books b
                  ON b.company_id = r.company_id
                 AND b.id = r.pp_book_id
                LEFT JOIN titles t
                  ON t.id = b.product_id
                LEFT JOIN agents a
                  ON a.id = r.agent_id
                LEFT JOIN pp_customer_books pcb
                  ON pcb.company_id = r.company_id
                 AND pcb.pp_customer_id = r.pp_customer_id
                 AND pcb.pp_book_id = r.pp_book_id
                WHERE r.company_id = %s
                  AND r.receipt_no = %s
                ORDER BY r.id DESC
                LIMIT 1
            """, [company_id, receipt_no])

            row = cur.fetchone()

        if not row:
            return JsonResponse({'error': f'Receipt {receipt_no} not found'}, status=404)

        # map columns
        data = {
            'id': row[0],
            'company_id': row[1],
            'receipt_no': row[2],
            'entry_date': row[3].isoformat() if row[3] else None,
            'pp_customer_id': row[4],
            'amount': str(row[5]) if row[5] is not None else None,
            'r_type': row[6],
            'a_type': row[7],
            'bank': row[8] or "",
            'chq_dd_no': row[9] or "",
            'installments': row[10] or "",
            'note1': row[11] or "",
            'pp_book_id': row[12],
            'customer_id': row[13],
            'agent_id': row[14],
            'exhibition_id': row[15],
            'user_id': row[16],
            'copies': row[17],
            'reg_no': row[18] or "",
            'pp_customer_nm': row[19] or "",
            'address1': row[20] or "",
            'address2': row[21] or "",
            'city': row[22] or "",
            'pin': row[23] or "",
            'telephone': row[24] or "",
            'agent_nm': row[25] or "",
            'title': row[26] or "",
            'pp_customer_book_id': row[27] or "",
        }

        return JsonResponse(data, status=200)

    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pp_installment_prefill(request):
    
    try:
        company_id = _get_request_company_id(request)
        reg_no = (request.GET.get('reg_no') or '').strip()
        if not reg_no:
            return JsonResponse({'error': 'reg_no is required'}, status=400)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    t.title,
                    pcb.copies,
                    pc.pp_customer_nm,
                    pc.address1,
                    pc.address2,
                    pc.city,
                    pc.pin,
                    pc.telephone,
                    pcb.pp_book_id,
                    pc.id AS pp_customer_id,
                    pr.agent_id AS agent_id,
                    a.agent_nm
                FROM pp_customers pc JOIN pp_customer_books pcb ON pc.id = pcb.pp_customer_id
                                     JOIN pp_books pb ON pb.company_id = pcb.company_id AND pcb.pp_book_id = pb.id
                                     JOIN titles t ON pb.product_id = t.id
                                     JOIN pp_receipts pr ON pr.company_id = pcb.company_id AND pr.pp_customer_book_id = pcb.id
                                     JOIN agents a on a.id = pr.agent_id                                     
               WHERE pcb.company_id = %s AND pcb.reg_no = %s
               LIMIT 1
                """,
                [company_id, reg_no]
            )
            row = cursor.fetchone()

        if not row:
            return JsonResponse({'error': 'No records found for given PP Reg. No.'}, status=404)

        data = {
            'title': row[0] or '',
            'copies': row[1],
            'pp_customer_nm': row[2] or '',
            'address1': row[3] or '',
            'address2': row[4] or '',
            'city': row[5] or '',
            'pin': row[6] or '',
            'telephone': row[7] or '',
            'pp_book_id': row[8],
            'pp_customer_id': row[9],
        }
        return JsonResponse(data, status=200)
    except KeyError as e:
        logger.warning("Missing required field in request handler: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in request handler: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sale_types_list(request):
    """Get all sale types from sale_types table"""
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT sale_typeid, sale_type
                FROM sale_types
                ORDER BY sale_typeid
                """
            )
            rows = cursor.fetchall()
        
        data = [{"sale_typeid": row[0], "sale_type": row[1] or ""} for row in rows]
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in sale_types_list: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sale_types_list: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sale_types_list")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bill_wise_sale_register_report(request):
    """Generate bill-wise sale register report"""
    try:
        branch_id = request.GET.get('branch_id')
        sale_type_id = request.GET.get('sale_type_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not sale_type_id or sale_type_id == '':
            return JsonResponse({'error': 'sale_type_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
            sale_type_id_int = int(sale_type_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_bill_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_date,
                    o_bill_no,
                    o_sale_type,
                    o_customer_nm,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount,
                    CAST(o_freight_postage AS numeric(18,2)) AS o_freight_postage,
                    o_note_1,
                    o_note_2,
                    o_user
                FROM get_sales_bill_wise(%s, %s, %s::date, %s::date)
                ORDER BY o_sale_date, o_bill_no
                """,
                [branch_id_int, sale_type_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sale_date': row[0].isoformat() if row[0] else None,
                'bill_no': row[1] or '',
                'sale_type': row[2] or '',
                'customer_nm': row[3] or '',
                'gross_sale': float(row[4]) if row[4] else 0.0,
                'nett_sale': float(row[5]) if row[5] else 0.0,
                'total_discount': float(row[6]) if row[6] else 0.0,
                'freight_postage': float(row[7]) if row[7] else 0.0,
                'note_1': row[8] or '',
                'note_2': row[9] or '',
                'user': row[10] or '',
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'sale_type_id': sale_type_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in bill_wise_sale_register_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in bill_wise_sale_register_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in bill_wise_sale_register_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def date_wise_sale_register_report(request):
    """Generate date-wise sale register report"""
    try:
        branch_id = request.GET.get('branch_id')
        sale_type_id = request.GET.get('sale_type_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not sale_type_id or sale_type_id == '':
            return JsonResponse({'error': 'sale_type_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
            sale_type_id_int = int(sale_type_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_bill_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_date,
                    o_bill_no,
                    o_sale_type,
                    o_customer_nm,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount,
                    CAST(o_freight_postage AS numeric(18,2)) AS o_freight_postage,
                    o_note_1,
                    o_note_2,
                    o_user
                FROM get_sales_bill_wise(%s, %s, %s::date, %s::date)
                ORDER BY o_sale_date, o_bill_no
                """,
                [branch_id_int, sale_type_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sale_date': row[0].isoformat() if row[0] else None,
                'bill_no': row[1] or '',
                'sale_type': row[2] or '',
                'customer_nm': row[3] or '',
                'gross_sale': float(row[4]) if row[4] else 0.0,
                'nett_sale': float(row[5]) if row[5] else 0.0,
                'total_discount': float(row[6]) if row[6] else 0.0,
                'freight_postage': float(row[7]) if row[7] else 0.0,
                'note_1': row[8] or '',
                'note_2': row[9] or '',
                'user': row[10] or '',
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'sale_type_id': sale_type_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in date_wise_sale_register_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in date_wise_sale_register_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in date_wise_sale_register_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def credit_customer_wise_sales_report(request):
    """Generate credit customer wise sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        credit_customer_id = request.GET.get('credit_customer_id')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)
        if not credit_customer_id:
            return JsonResponse({'error': 'credit_customer_id is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
            credit_customer_id_int = int(credit_customer_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_credit_customer_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_credit_customer,
                    o_sale_date,
                    o_bill_no,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount
                FROM get_sales_credit_customer_wise(%s, %s::date, %s::date, %s)
                ORDER BY o_credit_customer, o_sale_date, o_bill_no
                """,
                [branch_id_int, date_from, date_to, credit_customer_id_int]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'credit_customer': row[0] or '',
                'sale_date': row[1].isoformat() if row[1] else None,
                'bill_no': row[2] or '',
                'gross_sale': float(row[3]) if row[3] else 0.0,
                'nett_sale': float(row[4]) if row[4] else 0.0,
                'total_discount': float(row[5]) if row[5] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'credit_customer_id': credit_customer_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in credit_customer_wise_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in credit_customer_wise_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in credit_customer_wise_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cial_sale_register_report(request):
    """Generate CIAL sale register report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_cial_sales_register() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_date,
                    nos,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_discount AS numeric(18,2)) AS o_discount
                FROM get_cial_sales_register(%s, %s::date, %s::date)
                ORDER BY o_sale_date
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sale_date': row[0].isoformat() if row[0] else None,
                'nos': int(row[1]) if row[1] else 0,
                'nett_sale': float(row[2]) if row[2] else 0.0,
                'discount': float(row[3]) if row[3] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in cial_sale_register_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in cial_sale_register_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in cial_sale_register_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def abc_sale_register_report(request):
    """Generate ABC sale register report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_abc_sales_register() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_title,
                    o_quantity
                FROM get_abc_sales_register(%s, %s::date, %s::date)
                ORDER BY o_title
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'title': row[0] or '',
                'quantity': int(row[1]) if row[1] else 0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in abc_sale_register_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in abc_sale_register_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in abc_sale_register_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sales_agent_wise_report(request):
    """Generate sales agent-wise report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_agent_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_agent,
                    o_sale_date,
                    o_sale_type,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount
                FROM get_sales_agent_wise(%s, %s::date, %s::date)
                ORDER BY o_agent, o_sale_date, o_sale_type
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'agent': row[0] or '',
                'sale_date': row[1].isoformat() if row[1] else None,
                'sale_type': row[2] or '',
                'gross_sale': float(row[3]) if row[3] else 0.0,
                'nett_sale': float(row[4]) if row[4] else 0.0,
                'total_discount': float(row[5]) if row[5] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sales_agent_wise_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sales_agent_wise_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sales_agent_wise_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sale_and_stock_report(request):
    """Generate sale and stock report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sale_stock() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_publisher_nm,
                    o_title,
                    o_sold_quantity,
                    o_stock
                FROM get_sale_stock(%s, %s::date, %s::date)
                ORDER BY o_sold_quantity DESC
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'publisher_nm': row[0] or '',
                'title': row[1] or '',
                'sold_quantity': int(row[2]) if row[2] else 0,
                'stock': int(row[3]) if row[3] else 0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sale_and_stock_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sale_and_stock_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sale_and_stock_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_stock_statement_report(request):
    """Generate daily stock statement report"""
    try:
        branch_id = request.GET.get('branch_id')
        as_on_date = request.GET.get('as_on_date')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not as_on_date:
            return JsonResponse({'error': 'as_on_date is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        as_on_date_obj = parse_date(as_on_date)
        if not as_on_date_obj:
            return JsonResponse({'error': 'Invalid date format. Expected YYYY-MM-DD.'}, status=400)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_particulars,
                    o_type_id,
                    o_language_id,
                    o_own,
                    CAST(o_item_value AS numeric(18,2)) AS o_item_value
                FROM get_dss(%s, %s::date)
                ORDER BY o_type_id, o_particulars, o_language_id, o_own
                """,
                [branch_id_int, as_on_date]
            )
            dss_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    o_bill_no,
                    o_sale_type,
                    CAST(o_bill_amount AS numeric(18,2)) AS o_bill_amount
                FROM get_cancelled_sale_bills(%s, %s::date)
                ORDER BY o_bill_no, o_sale_type
                """,
                [branch_id_int, as_on_date]
            )
            cancelled_bill_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    o_title,
                    CAST(o_quantity AS numeric(18,2)) AS o_quantity,
                    CAST(o_inward_rate AS numeric(18,2)) AS o_inward_rate,
                    CAST(o_outward_rate AS numeric(18,2)) AS o_outward_rate
                FROM get_sold_items_with_more_less_value(%s, %s::date)
                ORDER BY o_title
                """,
                [branch_id_int, as_on_date]
            )
            modified_rate_rows = cursor.fetchall()

        report_data = {
            'stock_rows': [
                {
                    'particulars': row[0] or '',
                    'type_id': int(row[1]) if row[1] is not None else 0,
                    'language_id': int(row[2]) if row[2] is not None else 0,
                    'own': int(row[3]) if row[3] is not None else 0,
                    'item_value': _decimal_to_float(row[4]),
                }
                for row in dss_rows
            ],
            'cancelled_sale_bills': [
                {
                    'bill_no': row[0] or '',
                    'sale_type': row[1] or '',
                    'bill_amount': _decimal_to_float(row[2]),
                }
                for row in cancelled_bill_rows
            ],
            'sold_items_with_more_less_value': [
                {
                    'title': row[0] or '',
                    'quantity': _decimal_to_float(row[1]),
                    'inward_rate': _decimal_to_float(row[2]),
                    'outward_rate': _decimal_to_float(row[3]),
                }
                for row in modified_rate_rows
            ],
        }

        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'as_on_date': as_on_date,
            },
            'total_records': {
                'stock_rows': len(report_data['stock_rows']),
                'cancelled_sale_bills': len(report_data['cancelled_sale_bills']),
                'sold_items_with_more_less_value': len(report_data['sold_items_with_more_less_value']),
            }
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in daily_stock_statement_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in daily_stock_statement_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in daily_stock_statement_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def daily_account_statement_report(request):
    """Generate daily account statement report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        from_date_obj = parse_date(date_from)
        to_date_obj = parse_date(date_to)
        if not from_date_obj or not to_date_obj:
            return JsonResponse({'error': 'Invalid date format. Expected YYYY-MM-DD.'}, status=400)
        if from_date_obj > to_date_obj:
            return JsonResponse({'error': 'date_from cannot be greater than date_to'}, status=400)

        balance_keys = [
            'cl_cash',
            'cl_cheque',
            'cl_card_books',
            'cl_card_periodicals',
            'cl_card_calendar',
            'cl_card_diary',
            'cl_card_paperbox',
            'cl_card_others',
            'cl_upi_books',
            'cl_upi_periodicals',
            'cl_upi_calendar',
            'cl_upi_diary',
            'cl_upi_paperbox',
            'cl_upi_others',
        ]

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_type,
                    o_bill_from,
                    o_bill_to,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount
                FROM get_sales_type_wise(%s, %s::date, %s::date)
                ORDER BY o_sale_type, o_bill_from, o_bill_to
                """,
                [branch_id_int, date_from, date_to]
            )
            sales_type_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    o_language_id,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount
                FROM get_sales_language_wise(%s, %s::date, %s::date)
                ORDER BY o_language_id
                """,
                [branch_id_int, date_from, date_to]
            )
            language_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    o_sale_type,
                    o_bill_from,
                    o_bill_to,
                    CAST(o_nett AS numeric(18,2)) AS o_nett
                FROM get_sales_return_type_wise(%s, %s::date, %s::date)
                ORDER BY o_sale_type, o_bill_from, o_bill_to
                """,
                [branch_id_int, date_from, date_to]
            )
            sale_return_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT
                    COALESCE(SUM(cl_cash), 0.00) AS cl_cash,
                    COALESCE(SUM(cl_cheque), 0.00) AS cl_cheque,
                    COALESCE(SUM(cl_card_books), 0.00) AS cl_card_books,
                    COALESCE(SUM(cl_card_periodicals), 0.00) AS cl_card_periodicals,
                    COALESCE(SUM(cl_card_calendar), 0.00) AS cl_card_calendar,
                    COALESCE(SUM(cl_card_diary), 0.00) AS cl_card_diary,
                    COALESCE(SUM(cl_card_paperbox), 0.00) AS cl_card_paperbox,
                    COALESCE(SUM(cl_card_others), 0.00) AS cl_card_others,
                    COALESCE(SUM(cl_upi_books), 0.00) AS cl_upi_books,
                    COALESCE(SUM(cl_upi_periodicals), 0.00) AS cl_upi_periodicals,
                    COALESCE(SUM(cl_upi_calendar), 0.00) AS cl_upi_calendar,
                    COALESCE(SUM(cl_upi_diary), 0.00) AS cl_upi_diary,
                    COALESCE(SUM(cl_upi_paperbox), 0.00) AS cl_upi_paperbox,
                    COALESCE(SUM(cl_upi_others), 0.00) AS cl_upi_others
                FROM closed_dates
                WHERE company_id = %s
                  AND closed_date >= %s::date
                  AND closed_date <= %s::date
                """,
                [branch_id_int, date_from, date_to]
            )
            opening_balance_row = cursor.fetchone()

            cursor.execute(
                """
                SELECT
                    o_data_type,
                    o_trn_id,
                    o_entity_1,
                    o_entity_2,
                    o_description,
                    CAST(o_receipt AS numeric(18,2)) AS o_receipt,
                    CAST(o_payment AS numeric(18,2)) AS o_payment
                FROM get_incomes_and_expenses(%s, %s::date, %s::date)
                ORDER BY o_data_type, o_trn_id
                """,
                [branch_id_int, date_from, date_to]
            )
            income_expense_rows = cursor.fetchall()

            cursor.execute(
                """
                SELECT pronargs
                FROM pg_proc p
                JOIN pg_namespace n ON p.pronamespace = n.oid
                WHERE n.nspname = 'public'
                  AND p.proname = 'arrive_daily_account_closing'
                ORDER BY pronargs DESC
                LIMIT 1
                """
            )
            closing_signature = cursor.fetchone()
            closing_arg_count = closing_signature[0] if closing_signature else 0

            if closing_arg_count >= 3:
                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(o_amount_cash), 0.00) AS cl_cash,
                        COALESCE(SUM(o_amount_cheque), 0.00) AS cl_cheque,
                        COALESCE(SUM(o_amount_card_books), 0.00) AS cl_card_books,
                        COALESCE(SUM(o_amount_card_periodicals), 0.00) AS cl_card_periodicals,
                        COALESCE(SUM(o_amount_card_calendar), 0.00) AS cl_card_calendar,
                        COALESCE(SUM(o_amount_card_diary), 0.00) AS cl_card_diary,
                        COALESCE(SUM(o_amount_card_paperbox), 0.00) AS cl_card_paperbox,
                        COALESCE(SUM(o_amount_card_others), 0.00) AS cl_card_others,
                        COALESCE(SUM(o_amount_upi_books), 0.00) AS cl_upi_books,
                        COALESCE(SUM(o_amount_upi_periodicals), 0.00) AS cl_upi_periodicals,
                        COALESCE(SUM(o_amount_upi_calendar), 0.00) AS cl_upi_calendar,
                        COALESCE(SUM(o_amount_upi_diary), 0.00) AS cl_upi_diary,
                        COALESCE(SUM(o_amount_upi_paper_box), 0.00) AS cl_upi_paperbox,
                        COALESCE(SUM(o_amount_upi_others), 0.00) AS cl_upi_others
                    FROM arrive_daily_account_closing(%s, %s::date, %s::date)
                    """,
                    [branch_id_int, date_from, date_to]
                )
            else:
                cursor.execute(
                    """
                    SELECT
                        COALESCE(SUM(o_amount_cash), 0.00) AS cl_cash,
                        COALESCE(SUM(o_amount_cheque), 0.00) AS cl_cheque,
                        COALESCE(SUM(o_amount_card_books), 0.00) AS cl_card_books,
                        COALESCE(SUM(o_amount_card_periodicals), 0.00) AS cl_card_periodicals,
                        COALESCE(SUM(o_amount_card_calendar), 0.00) AS cl_card_calendar,
                        COALESCE(SUM(o_amount_card_diary), 0.00) AS cl_card_diary,
                        COALESCE(SUM(o_amount_card_paperbox), 0.00) AS cl_card_paperbox,
                        COALESCE(SUM(o_amount_card_others), 0.00) AS cl_card_others,
                        COALESCE(SUM(o_amount_upi_books), 0.00) AS cl_upi_books,
                        COALESCE(SUM(o_amount_upi_periodicals), 0.00) AS cl_upi_periodicals,
                        COALESCE(SUM(o_amount_upi_calendar), 0.00) AS cl_upi_calendar,
                        COALESCE(SUM(o_amount_upi_diary), 0.00) AS cl_upi_diary,
                        COALESCE(SUM(o_amount_upi_paper_box), 0.00) AS cl_upi_paperbox,
                        COALESCE(SUM(o_amount_upi_others), 0.00) AS cl_upi_others
                    FROM arrive_daily_account_closing(%s, %s::date)
                    """,
                    [branch_id_int, date_to]
                )
            closing_balance_row = cursor.fetchone()

        sales_type_summary = [
            {
                'sale_type': row[0] or '',
                'bill_from': row[1] or '',
                'bill_to': row[2] or '',
                'gross_sale': _decimal_to_float(row[3]),
                'nett_sale': _decimal_to_float(row[4]),
                'total_discount': _decimal_to_float(row[5]),
            }
            for row in sales_type_rows
        ]

        language_wise_sale = [
            {
                'language_id': int(row[0]) if row[0] is not None else 0,
                'gross_sale': _decimal_to_float(row[1]),
                'nett_sale': _decimal_to_float(row[2]),
                'total_discount': _decimal_to_float(row[3]),
            }
            for row in language_rows
        ]

        sale_return_summary = [
            {
                'sale_type': row[0] or '',
                'bill_from': int(row[1]) if row[1] is not None else 0,
                'bill_to': int(row[2]) if row[2] is not None else 0,
                'nett': _decimal_to_float(row[3]),
            }
            for row in sale_return_rows
        ]

        opening_balance = {
            key: _decimal_to_float(opening_balance_row[index]) if opening_balance_row else 0.0
            for index, key in enumerate(balance_keys)
        }

        incomes_and_expenses = [
            {
                'data_type': row[0] or '',
                'trn_id': int(row[1]) if row[1] is not None else 0,
                'entity_1': row[2] or '',
                'entity_2': row[3] or '',
                'description': row[4] or '',
                'receipt': _decimal_to_float(row[5]),
                'payment': _decimal_to_float(row[6]),
            }
            for row in income_expense_rows
        ]

        closing_balance = {
            key: _decimal_to_float(closing_balance_row[index]) if closing_balance_row else 0.0
            for index, key in enumerate(balance_keys)
        }

        return JsonResponse({
            'report_data': {
                'sales_type_summary': sales_type_summary,
                'language_wise_sale': language_wise_sale,
                'sale_return_summary': sale_return_summary,
                'opening_balance': opening_balance,
                'incomes_and_expenses': incomes_and_expenses,
                'closing_balance': closing_balance,
            },
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': {
                'sales_type_summary': len(sales_type_summary),
                'language_wise_sale': len(language_wise_sale),
                'sale_return_summary': len(sale_return_summary),
                'incomes_and_expenses': len(incomes_and_expenses),
            }
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in daily_account_statement_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in daily_account_statement_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in daily_account_statement_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_wise_sales_report(request):
    """Generate category wise sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_category_wise_sales() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_date,
                    o_category_nm,
                    CAST(o_discount_given AS numeric(18,2)) AS o_discount_given,
                    CAST(o_tax_collected AS numeric(18,2)) AS o_tax_collected,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale
                FROM get_category_wise_sales(%s, %s::date, %s::date)
                ORDER BY o_sale_date, o_category_nm
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sale_date': row[0].isoformat() if row[0] else None,
                'category_nm': row[1] or '',
                'discount_given': float(row[2]) if row[2] else 0.0,
                'tax_collected': float(row[3]) if row[3] else 0.0,
                'gross_sale': float(row[4]) if row[4] else 0.0,
                'nett_sale': float(row[5]) if row[5] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in category_wise_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_wise_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_wise_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def type_wise_sale_register_report(request):
    """Generate type-wise sale register report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_type_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sale_date,
                    o_sale_type,
                    CAST(o_gross_sale + o_total_discount AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount
                FROM get_sales_type_wise(%s, %s::date, %s::date)
                ORDER BY o_sale_date, o_sale_type
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sale_date': row[0].isoformat() if row[0] else None,
                'sale_type': row[1] or '',
                'gross_sale': float(row[2]) if row[2] else 0.0,
                'nett_sale': float(row[3]) if row[3] else 0.0,
                'total_discount': float(row[4]) if row[4] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in type_wise_sale_register_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in type_wise_sale_register_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in type_wise_sale_register_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sale_class_ratio_report(request):
    """Generate sales class ratio report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_class_ratio() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_class_nm,
                    CAST(o_amount AS numeric(18,2)) AS o_amount
                FROM get_sales_class_ratio(%s, %s::date, %s::date)
                ORDER BY o_amount DESC, o_class_nm
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'class_nm': row[0] or '',
                'amount': float(row[1]) if row[1] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sale_class_ratio_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sale_class_ratio_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sale_class_ratio_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def publisher_author_wise_sales_report(request):
    """Generate Publisher-Author wise sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_publisher_author_wise_sales() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_publisher_nm,
                    o_author_nm,
                    o_title,
                    o_quantity,
                    CAST(o_value AS numeric(18,2)) AS o_value
                FROM get_publisher_author_wise_sales(%s, %s::date, %s::date)
                ORDER BY o_publisher_nm, o_author_nm, o_title
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'publisher_nm': row[0] or '',
                'author_nm': row[1] or '',
                'title': row[2] or '',
                'quantity': int(row[3]) if row[3] else 0,
                'value': float(row[4]) if row[4] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in publisher_author_wise_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in publisher_author_wise_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in publisher_author_wise_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def sub_category_mode_product_wise_sales_report(request):
    """Generate sub category/mode/product wise sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_sales_sub_category_mode_product_wise() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sub_category_nm,
                    o_mode,
                    o_title,
                    CAST(o_gross_sale AS numeric(18,2)) AS o_gross_sale,
                    CAST(o_nett_sale AS numeric(18,2)) AS o_nett_sale,
                    CAST(o_total_discount AS numeric(18,2)) AS o_total_discount,
                    o_quantity
                FROM get_sales_sub_category_mode_product_wise(%s, %s::date, %s::date)
                ORDER BY o_sub_category_nm, o_mode, o_title
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sub_category_nm': row[0] or '',
                'mode': row[1] or '',
                'title': row[2] or '',
                'gross_sale': float(row[3]) if row[3] else 0.0,
                'nett_sale': float(row[4]) if row[4] else 0.0,
                'total_discount': float(row[5]) if row[5] else 0.0,
                'quantity': int(row[6]) if row[6] else 0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in sub_category_mode_product_wise_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in sub_category_mode_product_wise_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in sub_category_mode_product_wise_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def author_publisher_sales_report(request):
    """Generate Author-Publisher sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_author_publisher_wise_sales() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_author_nm,
                    o_publisher_nm,
                    o_title,
                    o_quantity,
                    CAST(o_value AS numeric(18,2)) AS o_value
                FROM get_author_publisher_wise_sales(%s, %s::date, %s::date)
                ORDER BY o_author_nm, o_publisher_nm, o_title
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'author_nm': row[0] or '',
                'publisher_nm': row[1] or '',
                'title': row[2] or '',
                'quantity': int(row[3]) if row[3] else 0,
                'value': float(row[4]) if row[4] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in author_publisher_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_publisher_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_publisher_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def category_publisher_author_wise_sales_report(request):
    """Generate Category-Publisher-Author wise sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_category_publisher_author_wise_sales() that the jrxml uses
        # The jrxml expects p_company_id, using branch_id as company_id
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_sub_category_nm,
                    o_publisher_nm,
                    o_author_nm,
                    o_title,
                    o_quantity,
                    CAST(o_value AS numeric(18,2)) AS o_value
                FROM get_category_publisher_author_wise_sales(%s, %s::date, %s::date)
                ORDER BY o_sub_category_nm, o_publisher_nm, o_author_nm, o_title
                """,
                [branch_id_int, date_from, date_to]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'sub_category_nm': row[0] or '',
                'publisher_nm': row[1] or '',
                'author_nm': row[2] or '',
                'title': row[3] or '',
                'quantity': int(row[4]) if row[4] else 0,
                'value': float(row[5]) if row[5] else 0.0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in category_publisher_author_wise_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in category_publisher_author_wise_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in category_publisher_author_wise_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def author_wise_title_sales_report(request):
    """Generate Author-Wise Title sales report"""
    try:
        branch_id = request.GET.get('branch_id')
        date_from = request.GET.get('date_from')
        date_to = request.GET.get('date_to')
        author_id = request.GET.get('author_id')

        if not branch_id:
            return JsonResponse({'error': 'branch_id is required'}, status=400)
        if not date_from:
            return JsonResponse({'error': 'date_from is required'}, status=400)
        if not date_to:
            return JsonResponse({'error': 'date_to is required'}, status=400)
        if not author_id:
            return JsonResponse({'error': 'author_id is required'}, status=400)

        try:
            branch_id_int = int(branch_id)
            author_id_int = int(author_id)
        except (ValueError, TypeError) as e:
            return JsonResponse({'error': 'Invalid parameter format.'}, status=400)

        # Query the database function get_author_wise_title_sales()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    o_title,
                    CAST(o_rate AS numeric(18,2)) AS o_rate,
                    o_quantity
                FROM get_author_wise_title_sales(%s, %s::date, %s::date, %s)
                ORDER BY o_title, o_rate DESC
                """,
                [branch_id_int, date_from, date_to, author_id_int]
            )
            rows = cursor.fetchall()

        # Format the data for JSON response
        report_data = []
        for row in rows:
            report_data.append({
                'title': row[0] or '',
                'rate': float(row[1]) if row[1] else 0.0,
                'quantity': int(row[2]) if row[2] else 0,
            })

        # Return the report data as JSON
        return JsonResponse({
            'report_data': report_data,
            'parameters': {
                'branch_id': branch_id_int,
                'date_from': date_from,
                'date_to': date_to,
                'author_id': author_id_int
            },
            'total_records': len(report_data)
        }, status=200)
    except KeyError as e:
        logger.warning("Missing required field in author_wise_title_sales_report: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in author_wise_title_sales_report: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in author_wise_title_sales_report")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)


################### REMITTANCE ENTRY ###################

def dictfetchall(cursor):
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def remittance_by_no(request):
    """
    Load one remittance by remittance_no.
    GET /auth/remittance-by-no/?remittance_no=...
    """
    rn = (request.GET.get("remittance_no") or "").strip()
    if not rn:
        return JsonResponse({"error": "remittance_no is required"}, status=400)

    try:
        company_id = _get_request_company_id(request)
        with connection.cursor() as cur:
            cur.execute("""
                SELECT r.company_id, r.id, r.remittance_no, r.entry_date, r.a_type, r.bank_id, r.amount,
                       r.ac_receipt_id, r.note1, r.cancelled, r.exhibition_id, r.c_name, r.account_id,
                       r.customer_id, r.pp_customer_id, r.user_id, r.printed,
                       b.branches_nm AS branch_name
                  FROM remittance r
             LEFT JOIN branches b ON b.id = r.account_id
                 WHERE r.company_id = %s AND r.remittance_no = %s
                 LIMIT 1
            """, [company_id, rn])
            rows = dictfetchall(cur)

        if not rows:
            return JsonResponse({"error": "Not found"}, status=404)
        return JsonResponse(rows[0])
    except KeyError as e:
        logger.warning("Missing required field in remittance_by_no: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in remittance_by_no: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in remittance_by_no")
        return JsonResponse({"error": "An unexpected error occurred."}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def remittance_save(request):
    """
    Insert into remittance per mapping:
      - company_id = selected branch id
      - id = MAX(id)+1 (per company)
      - remittance_no = get_next_value(company_id, '2526', 'REMITTANCE')
      - entry_date = payload.entry_date (YYYY-MM-DD)
      - a_type = payload.a_type (int)
      - bank_id = 0
      - amount = payload.amount (numeric)
      - ac_receipt_id = 0
      - note1 = payload.note1
      - cancelled = payload.cancelled (int)
      - exhibition_id = 0
      - c_name = "" if a_type corresponds to "Credit Sale Chq/DD", else "CASH/CARD/DIGITAL"
      - account_id = payload.account_id (branches.id)  [REQUIRED]
      - customer_id = payload.customer_id (cr_customers.id) or 0
      - pp_customer_id = payload.pp_customer_id (pp_customers.id) or 0
      - user_id = 0
      - printed = 0
    """
    try:
        data = json.loads(request.body.decode("utf-8"))
    except Exception:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    # Parse & validate incoming
    entry_date = data.get("entry_date")
    if not entry_date or parse_date(entry_date) is None:
        return JsonResponse({"error": "Invalid or missing entry_date"}, status=400)

    try:
        a_type = int(data.get("a_type", 0))
    except Exception:
        return JsonResponse({"error": "Invalid a_type"}, status=400)

    try:
        amount = decimal.Decimal(str(data.get("amount", "0") or "0"))
    except Exception:
        return JsonResponse({"error": "Invalid amount"}, status=400)

    note1 = data.get("note1") or None
    try:
        cancelled = int(data.get("cancelled", 0))
    except Exception:
        return JsonResponse({"error": "Invalid cancelled flag"}, status=400)

    try:
        account_id = int(data.get("account_id", 0))
    except Exception:
        return JsonResponse({"error": "Invalid account_id"}, status=400)

    try:
        customer_id = int(data.get("customer_id", 0))
    except Exception:
        return JsonResponse({"error": "Invalid customer_id"}, status=400)

    try:
        pp_customer_id = int(data.get("pp_customer_id", 0))
    except Exception:
        return JsonResponse({"error": "Invalid pp_customer_id"}, status=400)

    # c_name rule per spec
    c_name = (data.get("c_name") or "").strip()
    # If client sent empty for credit type that's fine; if they didn't, enforce:
    if a_type != 0 and not c_name:
        c_name = "CASH/CARD/DIGITAL"

    # Required: account_id (branch)
    if account_id <= 0:
        return JsonResponse({"error": "account_id (branch id) is required"}, status=400)

    try:
        company_id = _get_request_company_id(request)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Branch context missing. Please log in again.'}, status=400)
    bank_id = 0
    ac_receipt_id = 0
    exhibition_id = 0
    user_id = 0
    printed = 0

    try:
        with transaction.atomic():
            with connection.cursor() as cur:
                # Next internal id (per company)
                cur.execute("SELECT COALESCE(MAX(id), 0) + 1 FROM remittance WHERE company_id = %s", [company_id])
                next_id = cur.fetchone()[0]

                # Next remittance_no via provided function
                # Assuming get_next_value(company_id int, code text, series text) RETURNS int
                # cur.execute("SELECT get_next_value(%s, %s, %s)", [company_id, '2526', 'REMITTANCE'])
                next_remit_no = get_next_value(company_id, '2526', 'REMITTANCE')

                # Insert row
                cur.execute("""
                    INSERT INTO remittance(
                        company_id, id, remittance_no, entry_date, a_type, bank_id, amount, ac_receipt_id,
                        note1, cancelled, exhibition_id, c_name, account_id, customer_id, pp_customer_id,
                        user_id, printed
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s,
                        %s, %s
                    )
                """, [
                    company_id, next_id, next_remit_no, entry_date, a_type, bank_id, amount, ac_receipt_id,
                    note1, cancelled, exhibition_id, c_name, account_id, customer_id, pp_customer_id,
                    user_id, printed
                ])

        return JsonResponse({
            "message": "Remittance saved",
            "company_id": company_id,
            "id": next_id,
            "remittance_no": next_remit_no,
        })
    except KeyError as e:
        logger.warning("Missing required field in remittance_save: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in remittance_save: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in remittance_save")
        return JsonResponse({"error": "An unexpected error occurred."}, status=500)

################### CR REALISATION ENTRY ###################

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cr_realisation_by_customer_id(request):
    """
    Load receipts by customer id. Returns all necessary fields so the UI can fill everything.
    """
    try:
        company_id = _get_request_company_id(request)
        customer_id = request.GET.get('customer_id', '').strip()
        if not customer_id:
            return JsonResponse({'error': 'customer is required'}, status=400)

        with connection.cursor() as cur:
            cur.execute("""
                SELECT
                    cr.receipt_no,
                    cr.entry_date,
                    cr.bank,
                    cr.chq_dd_no,
                    cr.amount
                FROM cr_realisation cr
                WHERE cr.company_id = %s AND cr.customer_id = %s AND cr.a_type IN ( 2, 3, 5, 6 )
                ORDER BY cr.id DESC
                LIMIT 10
            """, [company_id, customer_id])
            rows = cur.fetchall()

        data = [{"receipt_no": r[0], "entry_date": r[1], "bank": r[2], "chq_dd_no": r[3], "amount": r[4] or ""} for r in rows]
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in finding customer details.: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in finding customer details.: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in finding customer details.")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
    

# SAVE
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cr_realisation_save(request):
    """
    POST /auth/cr-realisation-save/
    Body:
      entry_date, customer_id, amount, a_type, bank, chq_dd_no, note1, cancelled
    Creates a row in cr_realisation with:
      company_id=selected branch id, exhibition_id=0, user_id=0, printed=0
      receipt_no = get_next_value(company_id, '2526', 'CR_REAL')
    """
    try:
        body = request.data
        company_id = _get_request_company_id(request)
        entry_date = body.get('entry_date')
        customer_id = int(body.get('customer_id') or 0)
        amount = body.get('amount')
        a_type = int(body.get('a_type') or 0)
        bank = body.get('bank') or None
        chq_dd_no = body.get('chq_dd_no') or None
        note1 = body.get('note1') or None
        cancelled = int(body.get('cancelled') or 0)

        if not entry_date:
            return JsonResponse({'error': 'entry_date is required'}, status=400)
        if not customer_id:
            return JsonResponse({'error': 'customer_id is required'}, status=400)
        try:
            amount = float(amount)
        except Exception:
            return JsonResponse({'error': 'amount is required and must be numeric'}, status=400)

        with transaction.atomic():
            with connection.cursor() as cursor:
                receipt_no = get_next_value(company_id, '2526', 'CR_REAL')

                # Insert
                cursor.execute(
                    """
                    INSERT INTO cr_realisation
                      (company_id, receipt_no, entry_date, customer_id, amount, a_type, bank, chq_dd_no, note1, cancelled, exhibition_id, user_id, printed)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                       0, 0, 0)
                    """,
                    [company_id, receipt_no, entry_date, customer_id, amount, a_type, bank, chq_dd_no, note1, cancelled]
                )

        return JsonResponse(
            {'message': 'Credit realisation saved', 'receipt_no': receipt_no},
            status=200
        )
    except KeyError as e:
        logger.warning("Missing required field in cr_realisation_save: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in cr_realisation_save: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in cr_realisation_save")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)

# LOAD
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cr_realisation_by_no(request):
    """
    GET /auth/cr-realisation-by-no/?receipt_no=...
    Returns cr_realisation joined with customer name.
    """
    try:
        company_id = _get_request_company_id(request)
        rn = request.GET.get('receipt_no', '').strip()
        if not rn:
            return JsonResponse({'error': 'receipt_no is required'}, status=400)

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT r.company_id, r.id, r.receipt_no, r.entry_date, r.customer_id, c.customer_nm, r.amount, r.a_type, r.bank, r.chq_dd_no, r.note1, r.cancelled,
                       CONCAT_WS(', ', c.address_1, c.address_2, c.city) AS address
                  FROM cr_realisation r LEFT JOIN cr_customers c ON c.id = r.customer_id
                 WHERE r.company_id = %s AND r.receipt_no = %s
                """,
                [company_id, rn]
            )
            row = cursor.fetchone()

        if not row:
            return JsonResponse({'error': 'Not found'}, status=404)

        data = {
            'company_id': row[0],
            'id': row[1],
            'receipt_no': row[2],
            'entry_date': row[3].isoformat() if row[3] else None,
            'customer_id': row[4],
            'customer_nm': row[5] or "",
            'amount': float(row[6]) if row[6] is not None else None,
            'a_type': row[7],
            'bank': row[8] or "",
            'chq_dd_no': row[9] or "",
            'note1': row[10] or "",
            'cancelled': row[11],
            'address': row[12],
        }
        return JsonResponse(data, safe=False, json_dumps_params={'ensure_ascii': False})
    except KeyError as e:
        logger.warning("Missing required field in cr_realisation_by_no: %s", e)
        return JsonResponse({'error': f'Missing required field: {e}'}, status=400)
    except (ValueError, TypeError) as e:
        logger.warning("Invalid data format in cr_realisation_by_no: %s", e)
        return JsonResponse({'error': 'Invalid data format.'}, status=400)
    except Exception:
        logger.exception("Unexpected error in cr_realisation_by_no")
        return JsonResponse({'error': 'An unexpected error occurred.'}, status=500)
