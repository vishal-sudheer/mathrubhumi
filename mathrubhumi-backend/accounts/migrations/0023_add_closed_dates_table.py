from django.db import migrations


CLOSED_DATES_TABLE_SQL = r"""
CREATE TABLE IF NOT EXISTS public.closed_dates (
    company_id smallint DEFAULT 0 NOT NULL,
    closed_date date DEFAULT now() NOT NULL,
    cl_cash numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_cheque numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_books numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_periodicals numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_calendar numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_diary numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_paperbox numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_card_others numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_books numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_periodicals numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_calendar numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_diary numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_paperbox numeric(10,2) DEFAULT 0.00 NOT NULL,
    cl_upi_others numeric(10,2) DEFAULT 0.00 NOT NULL,
    closed_time timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    m_own_value numeric(10,2) DEFAULT 0.00 NOT NULL,
    m_others_value numeric(10,2) DEFAULT 0.00 NOT NULL,
    e_own_value numeric(10,2) DEFAULT 0.00 NOT NULL,
    e_others_value numeric(10,2) DEFAULT 0.00 NOT NULL,
    closed_by smallint DEFAULT 0 NOT NULL
);
"""

CLOSED_DATES_TABLE_REVERSE_SQL = r"""
DROP TABLE IF EXISTS public.closed_dates;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0022_add_sales_credit_customer_wise_function'),
    ]

    operations = [
        migrations.RunSQL(
            sql=CLOSED_DATES_TABLE_SQL,
            reverse_sql=CLOSED_DATES_TABLE_REVERSE_SQL,
        ),
    ]
