"""Backend test configuration.

Settings are forced to the unconfigured state so the suite proves the honest
degradation paths as well as the working ones.
"""

import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

for variable in (
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TRANSLATION_PROVIDER",
    "TRANSLATION_API_KEY",
    "TRANSLATION_API_URL",
    "COACH_MODEL",
    "COACH_API_KEY",
    "COACH_API_URL",
    "TRANSCRIPTION_PROVIDER",
    "TRANSCRIPTION_API_KEY",
    "TRANSCRIPTION_API_URL",
    "CONVERGE_CLIENT_TOKEN",
):
    os.environ.pop(variable, None)

os.environ["CONVERGE_ENV"] = "test"
os.environ["CONVERGE_RATE_LIMIT_PER_MINUTE"] = "1000"


@pytest.fixture(scope="session")
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture()
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client
