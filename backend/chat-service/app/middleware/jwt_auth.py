## JWT logic removed: OCR service does not require JWT
def decode_for_health(auth_header: str | None):
    return {"authenticated": False, "reason": "jwt-disabled"}