from django.test import TestCase
from django.urls import reverse
from django.db import connection
from rest_framework.test import APIClient

from .models import CustomUser, Role


class SalesReturnApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        role = Role.objects.create(name='cashier')
        cls.user = CustomUser.objects.create_user(
            email='salesrt@example.com',
            password='testpass123',
            name='Sales RT User',
            role=role,
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self._seed_reference_data()
        self.sale_id, self.sale_item_id = self._create_sale_with_item()

    def _seed_reference_data(self):
        with connection.cursor() as cur:
            cur.execute("DELETE FROM currencies WHERE id = %s", [1])
            cur.execute(
                "INSERT INTO currencies (id, currency_name, exchange_rate) VALUES (%s, %s, %s)",
                [1, 'Indian Rupees', 1],
            )

            cur.execute("DELETE FROM titles WHERE id = %s", [1])
            cur.execute(
                "INSERT INTO titles (id, title, rate, stock, tax) VALUES (%s, %s, %s, %s, %s)",
                [1, 'Test Book', 100, 0, 5],
            )

            cur.execute("DELETE FROM cr_customers WHERE id = %s", [1])
            cur.execute(
                "INSERT INTO cr_customers (id, customer_nm) VALUES (%s, %s)",
                [1, 'Test Customer'],
            )

            cur.execute(
                "DELETE FROM last_values WHERE company_id = %s AND fin_year = %s AND code = %s",
                [1, '2526', 'SALE_RT'],
            )
            cur.execute(
                "INSERT INTO last_values (company_id, fin_year, code, last_value) VALUES (%s, %s, %s, %s)",
                [1, '2526', 'SALE_RT', 0],
            )

    def _create_sale_with_item(self):
        with connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO sales (
                    customer_nm, bill_no, sale_date, company_id, user_id, agent_id, branch_id, cr_customer_id
                )
                VALUES (%s, %s, CURRENT_DATE, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                ['Test Customer', 'BILL-001', 1, 0, 0, 0, 1],
            )
            sale_id = cur.fetchone()[0]

            cur.execute(
                """
                INSERT INTO sale_items (
                    sale_id, quantity, rate, line_value, discount_p, title_id, exchange_rate, currency_id,
                    allocated_bill_discount, tax, purchase_item_id, company_id, purchase_company_id, purchase_id
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                [
                    sale_id,
                    1,
                    100,
                    100,
                    0,
                    1,
                    1,
                    1,
                    0,
                    5,
                    0,
                    1,
                    0,
                    0,
                ],
            )
            sale_item_id = cur.fetchone()[0]

        return sale_id, sale_item_id

    def _build_payload(self, qty=1, line_value=100, notes='Note 1'):
        return {
            'header': {
                'no': '',
                'date': '2026-01-19',
                'type': 'Credit Sale',
                'pay': 'Cash',
                'customer': 'Test Customer',
                'notes': notes,
                'disP': '0',
                'amt': '0',
                'nett': str(line_value),
                'rpv': '',
                'billNo': 'BILL-001',
            },
            'items': [
                {
                    'title_id': 1,
                    'qty': qty,
                    'rate': 100,
                    'tax': 5,
                    'exchange_rate': 1,
                    'discount_a': 0,
                    'line_value': line_value,
                    'sale_det_id': self.sale_item_id,
                    'purchase_company_id': 0,
                    'purchase_id': 0,
                    'purchase_det_id': 0,
                }
            ],
        }

    def test_sales_rt_bill_items(self):
        url = reverse('sales_rt_bill_items', kwargs={'sale_id': self.sale_id})
        res = self.client.get(url)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()), 1)
        self.assertEqual(res.json()[0]['id'], self.sale_item_id)
        self.assertEqual(res.json()[0]['currency_name'], 'Indian Rupees')

    def test_get_sale_by_bill_no(self):
        url = reverse('get_sale_by_bill_no')
        res = self.client.get(url, {'bill_no': 'BILL-001'}, HTTP_X_BRANCH_ID='1')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['id'], self.sale_id)
        self.assertEqual(res.json()['bill_no'], 'BILL-001')
        self.assertEqual(len(res.json()['items']), 1)

    def test_sales_rt_crud(self):
        create_url = reverse('sales_rt_create')
        create_res = self.client.post(create_url, self._build_payload(), format='json')
        self.assertEqual(create_res.status_code, 201)
        sales_rt_id = create_res.json()['id']

        detail_url = reverse('sales_rt_detail', kwargs={'id': sales_rt_id})
        detail_res = self.client.get(detail_url)
        self.assertEqual(detail_res.status_code, 200)
        self.assertEqual(detail_res.json()['cash_customer'], 'Test Customer')
        self.assertEqual(len(detail_res.json()['items']), 1)

        update_payload = self._build_payload(qty=2, line_value=200, notes='Updated Note')
        update_res = self.client.put(detail_url, update_payload, format='json')
        self.assertEqual(update_res.status_code, 200)

        updated = self.client.get(detail_url).json()
        self.assertEqual(updated['narration'], 'Updated Note')
        self.assertEqual(updated['items'][0]['quantity'], 2.0)
        self.assertEqual(updated['items'][0]['line_value'], 200.0)

        delete_res = self.client.delete(detail_url)
        self.assertEqual(delete_res.status_code, 200)
        missing = self.client.get(detail_url)
        self.assertEqual(missing.status_code, 404)
