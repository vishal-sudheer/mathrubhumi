from django.db import migrations


DAILY_ACCOUNTING_FUNCTIONS_SQL = r"""
DROP FUNCTION IF EXISTS public.get_sales_type_wise(integer, date, date);
CREATE OR REPLACE FUNCTION public.get_sales_type_wise(
    p_company_id integer,
    p_from_date date,
    p_to_date date
)
RETURNS TABLE(
    o_sale_date date,
    o_sale_type character varying,
    o_bill_from text,
    o_bill_to text,
    o_gross_sale numeric,
    o_nett_sale numeric,
    o_total_discount numeric
)
LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        sl.sale_date AS o_sale_date,
        st.sale_type AS o_sale_type,
        MIN(sl.bill_no)::text AS o_bill_from,
        MAX(sl.bill_no)::text AS o_bill_to,
        SUM(sl.gross)::numeric AS o_gross_sale,
        SUM(sl.bill_amount)::numeric AS o_nett_sale,
        SUM(
            ((si.quantity * si.rate * si.exchange_rate) * (si.discount_p / 100))
            + si.allocated_bill_discount
        )::numeric AS o_total_discount
    FROM sales sl
    JOIN sale_types st
        ON st.sale_typeid = sl.type
    JOIN sale_items si
        ON si.company_id = sl.company_id
       AND si.sale_id = sl.id
    WHERE sl.company_id = p_company_id
      AND sl.sale_date BETWEEN p_from_date AND p_to_date
      AND sl.cancel = 0
    GROUP BY sl.sale_date, st.sale_type
    ORDER BY sl.sale_date, st.sale_type;

    IF NOT FOUND THEN
        RETURN QUERY
        SELECT
            NULL::date,
            ''::varchar,
            ''::text,
            ''::text,
            0::numeric,
            0::numeric,
            0::numeric;
    END IF;

END;
$function$;

DROP FUNCTION IF EXISTS public.get_sales_language_wise(integer, date, date);
CREATE OR REPLACE FUNCTION public.get_sales_language_wise(
    p_company_id integer,
    p_from_date date,
    p_to_date date
)
RETURNS TABLE(
    o_language_id integer,
    o_gross_sale numeric,
    o_nett_sale numeric,
    o_total_discount numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.language_id::integer,
        SUM(sl.gross)::Numeric AS gross_sale,
        SUM(sl.bill_amount)::Numeric AS nett_sale,
        SUM(
            (
                (si.quantity * si.rate * si.exchange_rate)
                * (si.discount_p / 100)
            )
            + si.allocated_bill_discount
        )::Numeric AS total_discount
     FROM sales sl JOIN sale_types st ON st.sale_typeid = sl.type
                   JOIN sale_items si ON si.company_id = sl.company_id AND si.sale_id = sl.id
                   JOIN titles t ON si.title_id = t.id
    WHERE sl.company_id = p_company_id AND sl.sale_date BETWEEN p_from_date AND p_to_date AND sl.cancel = 0
    GROUP BY t.language_id
    ORDER BY t.language_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_sales_return_type_wise(integer, date, date);
CREATE OR REPLACE FUNCTION public.get_sales_return_type_wise(
    p_company_id integer,
    p_from_date date,
    p_to_date date
)
RETURNS TABLE(
    o_sale_type character varying,
    o_bill_from integer,
    o_bill_to integer,
    o_nett numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
        SELECT st.sale_type, MIN(sr.sales_rt_no) AS first_sale_rt_no, MAX(sr.sales_rt_no) AS last_sale_rt_no, SUM(sr.nett)
          FROM sales_rt sr JOIN sale_types st ON st.sale_typeid = sr.s_type
         WHERE sr.company_id = p_company_id AND sr.entry_date BETWEEN p_from_date AND p_to_date
      GROUP BY st.sale_type, sr.s_type
      ORDER BY sr.s_type;
END;
$$;

DROP FUNCTION IF EXISTS public.get_incomes_and_expenses(integer, date, date);
CREATE OR REPLACE FUNCTION public.get_incomes_and_expenses(
    p_company_id integer,
    p_from_date date,
    p_to_date date
)
RETURNS TABLE(
    o_data_type text,
    o_trn_id integer,
    o_entity_1 character varying,
    o_entity_2 character varying,
    o_description character varying,
    o_receipt numeric,
    o_payment numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
          SELECT '1 Remittance' AS data_type, r.id AS trn_id, b.branches_nm AS entity_1, COALESCE(cc.customer_nm, '') AS entity_2, r.note1 AS description,
                 COALESCE(r.amount, 0.00) AS receipt, 0.00 AS payment
            FROM remittance r JOIN payment_mode_types pmt ON r.a_type = pmt.id
                              JOIN cr_customers cc ON cc.id = r.customer_id
                              JOIN branches b ON b.id = r.account_id
           WHERE r.company_id = p_company_id AND r.entry_date BETWEEN p_from_date AND p_to_date AND r.cancelled = 0
      UNION ALL
          SELECT '2 Sale Total' AS data_type, 0 AS trn_id, 'Sale Total' AS entity_1, '' AS entity_2, '' AS description,
                 COALESCE(SUM(sl.bill_amount), 0.00) AS receipt, 0.00 AS payment
            FROM sales sl
           WHERE sl.company_id = p_company_id AND sl.sale_date BETWEEN p_from_date AND p_to_date AND sl.cancel = 0
      UNION ALL
          SELECT '3 Sale Return Total' AS data_type, 0 AS trn_id, 'Sale Return Total' AS entity_1, '' AS entity_2, '' AS description, 0.00 AS receipt,
                 COALESCE(SUM(sr.nett), 0.00) AS payment
            FROM sales_rt sr
           WHERE sr.company_id = p_company_id AND sr.entry_date BETWEEN p_from_date AND p_to_date
      UNION ALL
          SELECT '4 Collection' AS data_type, 0 AS trn_id, 'P P Receipts' AS entity_1, COALESCE('Receipt from ' || MIN(pr.receipt_no)::Text || ' to ' || MAX(pr.receipt_no), '')::Text AS entity_2,
                 '' AS description, COALESCE(SUM(pr.amount), 0.00) AS receipt, 0.00 AS payment
            FROM pp_receipts pr
           WHERE pr.company_id = p_company_id AND pr.entry_date BETWEEN p_from_date AND p_to_date AND pr.cancelled = 0
      UNION ALL
          SELECT '5 Credit Realisation' AS data_type, cr.id AS trn_id, cc.customer_nm AS entity_1, COALESCE(cc.address_1 || ' ' || cc.address_2 || ' ' || cc.city, '') AS entity_2,
                 cr.note1 AS description, COALESCE(cr.amount, 0.00) AS receipt, 0.00 AS payment
            FROM cr_realisation cr JOIN cr_customers cc ON cr.customer_id = cc.id
           WHERE cr.company_id = p_company_id AND cr.entry_date BETWEEN p_from_date AND p_to_date AND cr.cancelled = 0
      UNION ALL
          SELECT '6 Credit Sale' AS data_type, sl.id AS trn_id, cc.customer_nm AS entity_1, COALESCE(cc.city, '') AS entity_2, sl.bill_no AS description,
                 COALESCE(sl.bill_amount, 0.00) AS receipt, 0.00 AS payment
            FROM sales sl JOIN cr_customers cc ON sl.cr_customer_id = cc.id
           WHERE sl.company_id = p_company_id AND sl.sale_date BETWEEN p_from_date AND p_to_date AND sl.cancel = 0 AND sl.type = 0
      UNION ALL
          SELECT '7 Credit Sale Return' AS data_type, sr.id AS trn_id, cc.customer_nm AS entity_1, COALESCE(cc.city, '') AS entity_2, sr.sales_rt_no::Text AS description,
                 0.00 AS receipt, COALESCE(sr.nett, 0.00) AS payment
            FROM sales_rt sr JOIN cr_customers cc ON sr.cr_customer_id = cc.id
           WHERE sr.company_id = p_company_id AND sr.entry_date BETWEEN p_from_date AND p_to_date
      UNION ALL
          SELECT '8 Other Receipts' AS data_type, 0 AS trn_id, 'Freight/Postage/Cooly/Processing' AS entity_1, '' AS entity_2, '' AS description,
                 COALESCE(SUM(sl.freight_postage + sl.freight_postage), 0.00) AS receipt, 0.00 AS payment
            FROM sales sl
           WHERE sl.company_id = p_company_id AND sl.sale_date BETWEEN p_from_date AND p_to_date AND sl.cancel = 0;
END;
$$;

DROP FUNCTION IF EXISTS public.arrive_daily_account_closing(integer, date);
CREATE OR REPLACE FUNCTION public.arrive_daily_account_closing(
    p_company_id integer,
    p_as_on_date date
)
RETURNS TABLE(
    o_amount_cash numeric,
    o_amount_cheque numeric,
    o_amount_card_books numeric,
    o_amount_card_periodicals numeric,
    o_amount_card_calendar numeric,
    o_amount_card_diary numeric,
    o_amount_card_paperbox numeric,
    o_amount_card_others numeric,
    o_amount_upi_books numeric,
    o_amount_upi_periodicals numeric,
    o_amount_upi_calendar numeric,
    o_amount_upi_diary numeric,
    o_amount_upi_paper_box numeric,
    o_amount_upi_others numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH union_all_query AS (
        SELECT 'PPR' AS trn_type, pr.a_type, SUM(pr.amount) AS amount
        FROM pp_receipts pr
        WHERE pr.company_id = p_company_id
          AND pr.cancelled = 0
          AND pr.a_type IN (0, 5)
        GROUP BY pr.a_type

        UNION ALL

        SELECT 'SAL', sl."type" AS a_type, SUM(sl.bill_amount)
        FROM sales sl
        JOIN sale_items si
          ON si.company_id = sl.company_id AND si.sale_id = sl.id
        JOIN titles t
          ON si.title_id = t.id
        WHERE sl.company_id = p_company_id
          AND sl.type IN (1, 7)
          AND sl.cancel = 0
        GROUP BY sl."type"

        UNION ALL

        SELECT 'SRT', sr.s_type AS a_type, SUM(sr.nett)
        FROM sales_rt sr
        JOIN sale_rt_items sri
          ON sri.company_id = sr.company_id AND sri.parent_id = sr.id
        JOIN titles t
          ON sri.title_id = t.id
        WHERE sr.company_id = p_company_id
          AND sr.s_type IN (0, 5)
        GROUP BY sr.s_type

        UNION ALL

        SELECT 'SLP', sl."type" AS a_type,
               SUM(sl.freight_postage + sl.processing_charge::numeric)
        FROM sales sl
        WHERE sl.company_id = p_company_id
          AND sl.type IN (1, 7)
          AND sl.cancel = 0
          AND (sl.freight_postage + sl.processing_charge) <> 0
        GROUP BY sl."type"

        UNION ALL

        SELECT 'CRR', cr.a_type, SUM(cr.amount)
        FROM cr_realisation cr
        WHERE cr.company_id = p_company_id
          AND cr.cancelled = 0
          AND cr.a_type IN (0, 5)
        GROUP BY cr.a_type
    ),

    final_data AS (
        SELECT
            CASE trn_type
                WHEN 'PPR' THEN CASE a_type
                    WHEN 0 THEN 'Cash'
                    WHEN 5 THEN 'UPI Books'
                END

                WHEN 'CRR' THEN CASE a_type
                    WHEN 0 THEN 'Cash'
                    WHEN 5 THEN 'UPI Books'
                END

                WHEN 'SRT' THEN CASE a_type
                    WHEN 0 THEN 'Cash'
                    WHEN 5 THEN 'UPI Books'
                END

                WHEN 'SAL' THEN CASE a_type
                    WHEN 1  THEN 'Cash'
                    WHEN 5  THEN 'UPI Books'
                    WHEN 6  THEN 'UPI Periodicals'
                    WHEN 7  THEN 'UPI Calendar'
                    WHEN 8  THEN 'UPI Diary'
                    WHEN 9  THEN 'UPI Paperbox'
                    WHEN 10 THEN 'UPI Others'
                END

                WHEN 'SLP' THEN CASE a_type
                    WHEN 1  THEN 'Cash'
                    WHEN 5  THEN 'UPI Books'
                    WHEN 6  THEN 'UPI Periodicals'
                    WHEN 7  THEN 'UPI Calendar'
                    WHEN 8  THEN 'UPI Diary'
                    WHEN 9  THEN 'UPI Paperbox'
                    WHEN 10 THEN 'UPI Others'
                END
            END AS payment_mode,
            amount
        FROM union_all_query
    )

    SELECT
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Cash'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Cheque'), 0),

        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Books'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Periodicals'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Calendar'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Diary'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Paperbox'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'Card Others'), 0),

        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Books'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Periodicals'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Calendar'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Diary'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Paperbox'), 0),
        COALESCE(SUM(amount) FILTER (WHERE payment_mode = 'UPI Others'), 0)
    FROM final_data;
END;
$$;
"""

DAILY_ACCOUNTING_FUNCTIONS_REVERSE_SQL = r"""
DROP FUNCTION IF EXISTS public.get_sales_type_wise(integer, date, date);
DROP FUNCTION IF EXISTS public.get_sales_language_wise(integer, date, date);
DROP FUNCTION IF EXISTS public.get_sales_return_type_wise(integer, date, date);
DROP FUNCTION IF EXISTS public.get_incomes_and_expenses(integer, date, date);
DROP FUNCTION IF EXISTS public.arrive_daily_account_closing(integer, date);
"""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0023_add_closed_dates_table'),
    ]

    operations = [
        migrations.RunSQL(
            sql=DAILY_ACCOUNTING_FUNCTIONS_SQL,
            reverse_sql=DAILY_ACCOUNTING_FUNCTIONS_REVERSE_SQL,
        ),
    ]
