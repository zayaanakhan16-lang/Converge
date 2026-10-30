"""Report intake.

Reports are written by the client to Supabase directly (RLS allows a member to
insert their own report). This endpoint exists for the moderation queue: it
lists open reports and records a decision, and it is the only place the service
role key is used for reporting.

It requires the client token and returns 503 when Supabase is not configured,
rather than pretending a queue exists.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from ..api.dependencies import rate_limited, require_client_token
from ..core.config import Settings, get_settings
from ..core.errors import ProviderUnavailableError
from ..schemas.requests import ReportRequest, ReportResponse

router = APIRouter(tags=["moderation"], dependencies=[Depends(rate_limited)])


def _supabase(settings: Annotated[Settings, Depends(get_settings)]):
    if not settings.supabase_enabled:
        raise ProviderUnavailableError(
            "Moderation needs a configured Supabase project. Set SUPABASE_URL and "
            "SUPABASE_SERVICE_ROLE_KEY on the Converge backend."
        )
    from supabase import create_client  # imported lazily: optional dependency

    return create_client(settings.supabase_url, settings.supabase_service_role_key)


@router.post(
    "/reports",
    response_model=ReportResponse,
    dependencies=[Depends(require_client_token)],
)
async def create_report(
    payload: ReportRequest,
    client: Annotated[object, Depends(_supabase)],
) -> ReportResponse:
    if not payload.subject_user_id and not payload.subject_message_id:
        raise ProviderUnavailableError(
            "A report must name either the member or the message it concerns."
        )
    row = {
        "subject_user_id": payload.subject_user_id,
        "subject_message_id": payload.subject_message_id,
        "reason": payload.reason,
        "detail": payload.detail,
    }
    response = client.table("reports").insert(row).execute()
    records = response.data or []
    if not records:
        raise ProviderUnavailableError("The report could not be recorded.")
    return ReportResponse(id=str(records[0]["id"]), status=records[0].get("status", "open"))
