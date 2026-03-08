from django.db import migrations


PAYMENT_MODE_TYPES_TABLE_SQL = r"""
CREATE TABLE IF NOT EXISTS public.payment_mode_types (
    id smallint NOT NULL,
    payment_mode text NOT NULL
);
"""

PAYMENT_MODE_TYPES_TABLE_REVERSE_SQL = r"""
DROP TABLE IF EXISTS public.payment_mode_types;
"""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0024_add_daily_accounting_functions'),
    ]

    operations = [
        migrations.RunSQL(
            sql=PAYMENT_MODE_TYPES_TABLE_SQL,
            reverse_sql=PAYMENT_MODE_TYPES_TABLE_REVERSE_SQL,
        ),
    ]
