#!/usr/bin/env python3
"""
FYERS Token Refresher
Automatically refreshes Fyers access token (regenerates every 24 hours) and updates .env.

Usage:
  # Refresh token using fyers_apiv3 library (recommended for production)
  python scripts/refresh-fyers-token.py

  # Check token status without updating
  python scripts/refresh-fyers-token.py --check

  # Force refresh with redirect code (manual auth flow)
  python scripts/refresh-fyers-token.py --auth <redirect-code>

  # Set up cron job to auto-refresh daily
  0 3 * * * cd /path/to/tradeTracker && python scripts/refresh-fyers-token.py >> logs/token-refresh.log 2>&1
"""

import sys
import os
import json
from datetime import datetime
from pathlib import Path

# Get project root
PROJECT_ROOT = Path(__file__).parent.parent
ENV_PATH = Path("/Users/iayusshh/Work/tradeTracker/.env")
LOG_DIR = PROJECT_ROOT / "logs"


def load_env():
    """Load current .env into a dict."""
    if not ENV_PATH.exists():
        return {}

    env = {}
    with open(ENV_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                env[key.strip()] = val.strip()
    return env


def save_env(env_dict):
    """Save env dict back to .env, preserving comments and order."""
    if not ENV_PATH.exists():
        ENV_PATH.write_text("")

    # Read existing file to preserve structure
    existing = ENV_PATH.read_text() if ENV_PATH.exists() else ""
    lines = existing.split("\n") if existing else []

    # Update values while preserving structure
    new_lines = []
    updated_keys = set()

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            new_lines.append(line)
        elif "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in env_dict:
                new_lines.append(f"{key}={env_dict[key]}")
                updated_keys.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)

    # Append new keys not found in existing file
    for key, val in env_dict.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={val}")

    content = "\n".join(new_lines)
    if not content.endswith("\n"):
        content += "\n"

    ENV_PATH.write_text(content)


def log(message):
    """Log message with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    msg = f"[{timestamp}] {message}"
    print(msg)

    # Also write to log file
    LOG_DIR.mkdir(exist_ok=True)
    log_file = LOG_DIR / "token-refresh.log"
    with open(log_file, "a") as f:
        f.write(msg + "\n")


def get_fyers_config():
    """Load Fyers config from environment or .env."""
    env = load_env()
    return {
        "app_id": os.environ.get("FYERS_APP_ID") or env.get("FYERS_APP_ID", ""),
        "access_token": os.environ.get("FYERS_ACCESS_TOKEN") or env.get("FYERS_ACCESS_TOKEN", ""),
        "redirect_uri": os.environ.get("FYERS_REDIRECT_URI") or env.get("FYERS_REDIRECT_URI", ""),
        "secret_key": os.environ.get("FYERS_SECRET_ID") or env.get("FYERS_SECRET_ID", ""),
    }


def check_token_status():
    """Check if current token is valid."""
    try:
        from fyers_apiv3 import fyersModel
    except ImportError:
        log("ERROR: fyers_apiv3 not installed. Install with: pip install fyers-apiv3")
        return False

    config = get_fyers_config()
    if not config["access_token"]:
        log("ERROR: No access token found in environment or .env")
        return False

    try:
        client = fyersModel.FyersModel(
            client_id=config["app_id"],
            is_async=False,
            token=config["access_token"],
            log_path=""
        )

        # Try a simple API call to validate token
        resp = client.quotes({"symbols": "NSE:NIFTY50-INDEX"})
        if resp.get("code") == 200 or resp.get("s") == "ok":
            log("✓ Token is valid")
            return True
        else:
            log(f"✗ Token validation failed: {resp.get('message', resp)}")
            return False
    except Exception as e:
        log(f"✗ Error checking token: {str(e)}")
        return False


def refresh_token_web_flow():
    """Refresh token using web-based OAuth flow (opens browser).

    Note: This requires user interaction. For production cron jobs,
    use option --auth with a pre-generated auth code instead.
    """
    try:
        from fyers_apiv3 import fyersModel
    except ImportError:
        log("ERROR: fyers_apiv3 not installed. Install with: pip install fyers-apiv3")
        return False

    config = get_fyers_config()

    if not config["app_id"] or not config["secret_key"] or not config["redirect_uri"]:
        log("ERROR: Missing FYERS_APP_ID, FYERS_SECRET_ID, or FYERS_REDIRECT_URI")
        log("Set these in .env or environment variables before refreshing.")
        return False

    try:
        # Initialize session for auth
        session = fyersModel.SessionModel(
            client_id=config["app_id"],
            secret_key=config["secret_key"],
            redirect_uri=config["redirect_uri"],
            response_type="code",
            grant_type="authorization_code",
            state="optional_state"
        )

        # Generate auth URL
        auth_url = session.generate_authcode()
        log(f"✓ Generated auth URL: {auth_url}")
        log("Please open this URL in your browser and authorize the app.")

        # Wait for user to provide auth code
        auth_code = input("Enter the auth code from redirect URL: ").strip()

        if not auth_code:
            log("ERROR: No auth code provided")
            return False

        # Exchange auth code for access token
        session.set_token(auth_code)
        token_response = session.generate_token()

        if not token_response or not token_response.get("access_token"):
            log(f"ERROR: Failed to get token: {token_response}")
            return False

        new_token = token_response["access_token"]
        log(f"✓ Obtained new access token")

        # Update .env
        env = load_env()
        env["FYERS_ACCESS_TOKEN"] = new_token
        save_env(env)
        log(f"✓ Updated .env with new token")
        log("Restart your development server: npm run dev")

        return True

    except Exception as e:
        log(f"ERROR: Token refresh failed: {str(e)}")
        return False


def refresh_token_with_auth_code(auth_code):
    """Refresh token using a pre-generated auth code (for CI/cron jobs)."""
    try:
        from fyers_apiv3 import fyersModel
    except ImportError:
        log("ERROR: fyers_apiv3 not installed. Install with: pip install fyers-apiv3")
        return False

    config = get_fyers_config()

    if not config["app_id"] or not config["secret_key"] or not config["redirect_uri"]:
        log("ERROR: Missing FYERS_APP_ID, FYERS_SECRET_ID, or FYERS_REDIRECT_URI")
        return False

    try:
        session = fyersModel.SessionModel(
            client_id=config["app_id"],
            secret_key=config["secret_key"],
            redirect_uri=config["redirect_uri"],
            response_type="code",
            grant_type="authorization_code",
            state="optional_state"
        )

        session.set_token(auth_code)
        token_response = session.generate_token()

        if not token_response or not token_response.get("access_token"):
            log(f"ERROR: Failed to exchange auth code: {token_response}")
            return False

        new_token = token_response["access_token"]
        log(f"✓ Exchanged auth code for new token")

        # Update .env
        env = load_env()
        env["FYERS_ACCESS_TOKEN"] = new_token
        save_env(env)
        log(f"✓ Updated .env with new token")

        return True

    except Exception as e:
        log(f"ERROR: Token refresh failed: {str(e)}")
        return False


def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "--check":
            check_token_status()
            return
        elif sys.argv[1] == "--auth" and len(sys.argv) > 2:
            auth_code = sys.argv[2]
            if refresh_token_with_auth_code(auth_code):
                log("SUCCESS: Token refreshed")
            else:
                sys.exit(1)
            return

    # Default: interactive web flow
    log("Starting Fyers token refresh...")
    if refresh_token_web_flow():
        log("SUCCESS: Token refreshed")
    else:
        log("FAILED: Token refresh incomplete")
        sys.exit(1)


if __name__ == "__main__":
    main()
