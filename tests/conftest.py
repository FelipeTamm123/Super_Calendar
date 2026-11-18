"""Los tests no tocan Supabase: usan variables falsas y reemplazan dependencias."""
import os

os.environ.update(
    {
        "SUPABASE_URL": "https://test.supabase.co",
        "SUPABASE_PUBLISHABLE_KEY": "sb_publishable_test",
        "SUPABASE_SECRET_KEY": "sb_secret_test_no_es_real",
        "GOOGLE_CLIENT_ID": "",
        "GOOGLE_CLIENT_SECRET": "",
        "SUPABASE_JWKS_URL": "https://test.supabase.co/auth/v1/.well-known/jwks.json",
        "APP_ENV": "test",
    }
)
