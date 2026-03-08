from django.db import migrations


DSS_FUNCTIONS_SQL = r"""
DROP FUNCTION IF EXISTS public.get_dss(integer, date);
CREATE FUNCTION public.get_dss(p_company_id integer, p_as_on_date date) RETURNS TABLE(o_particulars text, o_type_id integer, o_language_id integer, o_own integer, o_item_value numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
       SELECT s.supplier_nm || ' Bill No.' || p.invoice_no::text || ' dtd ' || TO_CHAR(p.invoice_date, 'DD-MM-YYYY') AS particulars, 2 AS type_id,
              t.language_id, b.own, SUM(pi.quantity * pi.rate * pi.exchange_rate) AS title_value
         FROM purchase p JOIN purchase_items pi ON p.company_id = pi.company_id AND p.id = pi.purchase_id
                         JOIN suppliers s ON s.id = p.supplier_id
                         JOIN titles t ON t.id = pi.title_id
                         JOIN publishers b ON b.id = t.publisher_id
        WHERE p.company_id = p_company_id AND p.transaction_type = 0
     GROUP BY s.supplier_nm, p.invoice_no, p.invoice_date, t.language_id, b.own
    UNION ALL
       SELECT s.supplier_nm || ' Bill No.' || p.invoice_no::text || ' dtd ' || TO_CHAR(p.invoice_date, 'DD-MM-YYYY') AS particulars, 7 AS type_id,
              t.language_id, b.own, SUM(pi.quantity * pi.rate * pi.exchange_rate) AS title_value
         FROM purchase p JOIN purchase_items pi ON p.company_id = pi.company_id AND p.id = pi.purchase_id
                         JOIN suppliers s ON s.id = p.supplier_id
                         JOIN titles t ON t.id = pi.title_id
                         JOIN publishers b ON b.id = t.publisher_id
        WHERE p.company_id = p_company_id AND p.transaction_type = 2
     GROUP BY s.supplier_nm, p.invoice_no, p.invoice_date, t.language_id, b.own
    UNION ALL
       SELECT st.sale_type AS particulars, 3 AS type_id, t.language_id, b.own, SUM(si.quantity * si.rate * si.exchange_rate) AS title_value
         FROM sales s JOIN sale_items si ON s.company_id = si.company_id AND s.id = si.sale_id
                      JOIN sale_types st ON s."type" = st.sale_typeid
                      JOIN titles t ON t.id = si.title_id
                      JOIN publishers b ON b.id = t.publisher_id
        WHERE s.company_id = p_company_id AND s.type != 3
     GROUP BY st.sale_type, t.language_id, b.own
    UNION ALL
       SELECT 'Stock Transfer to ' || b.branches_nm || ' No.' || s.bill_no || ' dtd ' || TO_CHAR(s.sale_date, 'DD-MM-YYYY') AS particulars,
              3 AS type_id, t.language_id, p.own, SUM(si.quantity * si.rate * si.exchange_rate) AS title_value
         FROM sales s JOIN sale_items si ON s.company_id = si.company_id AND s.id = si.sale_id
                      JOIN titles t ON si.title_id = t.id
                      JOIN publishers p ON  t.publisher_id = p.id
                      JOIN branches b ON s.branch_id = b.id
        WHERE s.company_id = p_company_id AND s.type = 3
     GROUP BY b.branches_nm, s.sale_date, s.bill_no, t.language_id, p.own
    UNION ALL
       SELECT s.supplier_nm || ' ' || left(pr.narration, 30 ) AS particulars, 5 AS type_id, t.language_id, p.own,
              SUM(pri.quantity * pri.rate * pri.exchange_rate) AS title_value
         FROM purchase_rt pr JOIN purchase_rt_items pri ON pr.company_id = pri.company_id AND pr.id = pri.parent_id
                             JOIN titles t ON pri.title_id = t.id
                             JOIN publishers p ON t.publisher_id = p.id
                             JOIN suppliers s ON pr.supplier_id = s.id
        WHERE pr.company_id = p_company_id
     GROUP BY s.supplier_nm, pr.narration, t.language_id, p.own
    UNION ALL
       SELECT st.sale_type AS particulars, 6 AS type_id, t.language_id, p.own, SUM(sri.quantity * sri.rate * sri.exchange_rate) AS title_value
         FROM sales_rt sr JOIN sale_rt_items sri ON sr.company_id = sri.company_id AND sr.id = sri.parent_id
                      JOIN titles t ON sri.title_id = t.id
                      JOIN publishers p ON  t.publisher_id = p.id
                      JOIN sale_types st ON sr.s_type = st.sale_typeid
        WHERE sr.company_id = p_company_id
     GROUP BY st.sale_type, t.language_id, p.own
    UNION ALL
       SELECT 'IN AS PER APPROVAL' AS particulars, 7 AS type_id, 1 AS language_id, 0 own, 0.00 AS title_value
         FROM sales s
        WHERE s.company_id = 0
    UNION ALL
       SELECT 'IN AS PER STOCK CORRECTION' AS particulars, 8 AS type_id, 1 AS language_id, 0 own, 0.00 AS title_value
         FROM sales s
        WHERE s.company_id = 0
    UNION ALL
       SELECT 'OUT AS PER STOCK CORRECTION' AS particulars, 9 AS type_id, 1 AS language_id, 0 own, 0.00 AS title_value
         FROM sales s
        WHERE s.company_id = 0
    UNION ALL
       SELECT 'OUT AS PER DAMAGE' AS particulars, 10 AS type_id, 1 AS language_id, 0 own, 0.00 AS title_value
         FROM sales s
        WHERE s.company_id = 0;
END;
$$;

DROP FUNCTION IF EXISTS public.get_cancelled_sale_bills(integer, date);
CREATE FUNCTION public.get_cancelled_sale_bills(p_company_id integer, p_as_on_date date) RETURNS TABLE(o_bill_no character varying, o_sale_type character varying, o_bill_amount numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
       SELECT s.bill_no, st.sale_type, s.bill_amount
         FROM sales s JOIN sale_types st ON s."type" = st.sale_typeid
        WHERE s.company_id = p_company_id AND s.sale_date = p_as_on_date AND s.cancel = 1;
END;
$$;

DROP FUNCTION IF EXISTS public.get_sold_items_with_more_less_value(integer, date);
CREATE FUNCTION public.get_sold_items_with_more_less_value(p_company_id integer, p_as_on_date date) RETURNS TABLE(o_title character varying, o_quantity numeric, o_inward_rate numeric, o_outward_rate numeric)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
       SELECT t.title, si.quantity, COALESCE( pi.rate * pi.exchange_rate * si.quantity, 0.00 ) AS inward_rate,
              COALESCE( si.quantity * si.rate * si.exchange_rate, 0.00 ) AS outward_rate
         FROM sale_items si JOIN purchase_items pi ON si.purchase_company_id = pi.company_id AND si.purchase_item_id = pi.id AND si.purchase_item_id = pi.id
                            JOIN sales s ON s.company_id = si.company_id AND s.id = si.sale_id
                            JOIN titles t ON t.id = si.title_id
        WHERE s.company_id = p_company_id AND s.sale_date = p_as_on_date AND s.cancel = 0
          AND ( pi.rate * pi.exchange_rate ) < ( si.rate * si.exchange_rate )
    UNION ALL
       SELECT t.title, si.quantity, COALESCE( pi.rate * pi.exchange_rate * si.quantity, 0.00 ) AS inward_rate,
              COALESCE( si.quantity * si.rate * si.exchange_rate, 0.00 ) AS outward_rate
         FROM sale_items si JOIN purchase_items pi ON si.purchase_company_id = pi.company_id AND si.purchase_item_id = pi.id AND si.purchase_item_id = pi.id
                            JOIN sales s ON s.company_id = si.company_id AND s.id = si.sale_id
                            JOIN titles t ON t.id = si.title_id
        WHERE s.company_id = p_company_id AND s.sale_date = p_as_on_date AND s.cancel = 0
          AND ( pi.rate * pi.exchange_rate ) > ( si.rate * si.exchange_rate );
END;
$$;
"""

DSS_FUNCTIONS_REVERSE_SQL = r"""
DROP FUNCTION IF EXISTS public.get_dss(integer, date);
DROP FUNCTION IF EXISTS public.get_cancelled_sale_bills(integer, date);
DROP FUNCTION IF EXISTS public.get_sold_items_with_more_less_value(integer, date);
"""


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0025_add_payment_mode_types_table'),
    ]

    operations = [
        migrations.RunSQL(
            sql=DSS_FUNCTIONS_SQL,
            reverse_sql=DSS_FUNCTIONS_REVERSE_SQL,
        ),
    ]
