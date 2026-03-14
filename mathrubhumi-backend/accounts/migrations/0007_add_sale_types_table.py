from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0005_userbranch'),
    ]

    operations = [
        migrations.RunSQL(sql=migrations.RunSQL.noop, reverse_sql=migrations.RunSQL.noop),
    ]
