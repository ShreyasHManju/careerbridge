from abc import ABC, abstractmethod
from email.headerregistry import Address
from email.message import EmailMessage
import logging
import smtplib
from typing import Any, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger("careerbridge.email")


class BaseEmailProvider(ABC):
    """
    Abstract interface for email delivery providers.
    """

    @abstractmethod
    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> bool:
        """
        Send an email notification.
        Returns True on success, or raises an exception on fatal provider failure.
        """
        pass


class LocalEmailProvider(BaseEmailProvider):
    """
    In-memory email provider for development, testing, and CI environments.
    Stores sent messages in memory for inspection and assertions.
    """

    def __init__(self) -> None:
        self._sent_emails: List[Dict[str, Any]] = []

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> bool:
        record = {
            "to_email": to_email,
            "from_email": settings.EMAIL_FROM,
            "from_name": settings.EMAIL_FROM_NAME,
            "subject": subject,
            "text_body": text_body,
            "html_body": html_body,
            "event_type": event_type,
        }
        self._sent_emails.append(record)
        logger.info(
            f"[LocalEmailProvider] Delivered email to '{to_email}' with subject '{subject}' (event: {event_type})"
        )
        return True

    def get_sent_emails(self) -> List[Dict[str, Any]]:
        """Return a copy of all sent email records."""
        return list(self._sent_emails)

    def get_last_email(self) -> Optional[Dict[str, Any]]:
        """Return the most recently sent email record, or None if none sent."""
        return self._sent_emails[-1] if self._sent_emails else None

    def clear(self) -> None:
        """Clear the in-memory sent emails list."""
        self._sent_emails.clear()


class SMTPEmailProvider(BaseEmailProvider):
    """
    Transactional SMTP email provider using standard library smtplib.
    Supports STARTTLS, authentication, and multipart (text/html) payloads.
    """

    def __init__(
        self,
        host: Optional[str] = None,
        port: Optional[int] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: Optional[bool] = None,
        from_email: Optional[str] = None,
        from_name: Optional[str] = None,
    ) -> None:
        self.host = host if host is not None else settings.SMTP_HOST
        self.port = port if port is not None else settings.SMTP_PORT
        self.username = username if username is not None else settings.SMTP_USERNAME
        self.password = password if password is not None else settings.SMTP_PASSWORD
        self.use_tls = use_tls if use_tls is not None else settings.SMTP_USE_TLS
        self.from_email = from_email if from_email is not None else settings.EMAIL_FROM
        self.from_name = from_name if from_name is not None else settings.EMAIL_FROM_NAME

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> bool:
        if not self.host:
            raise ValueError("SMTP_HOST is not configured. Cannot send email via SMTP.")

        msg = EmailMessage()
        msg["Subject"] = subject
        msg["From"] = f"{self.from_name} <{self.from_email}>"
        msg["To"] = to_email
        msg.set_content(text_body)

        if html_body:
            msg.add_alternative(html_body, subtype="html")

        try:
            with smtplib.SMTP(self.host, self.port, timeout=15) as server:
                if self.use_tls:
                    server.starttls()
                if self.username and self.password:
                    server.login(self.username, self.password)
                server.send_message(msg)

            logger.info(
                f"[SMTPEmailProvider] Dispatched email to '{to_email}' via {self.host}:{self.port} (event: {event_type})"
            )
            return True
        except Exception as exc:
            logger.error(
                f"[SMTPEmailProvider] Failed to send email to '{to_email}' via {self.host}:{self.port}: {exc}"
            )
            raise


# Shared singleton for LocalEmailProvider so application dispatches and test assertions share the state
_default_local_provider = LocalEmailProvider()


def get_email_provider(provider_type: Optional[str] = None) -> BaseEmailProvider:
    """
    Factory function returning the configured email provider.
    """
    selected = (provider_type or settings.EMAIL_PROVIDER).strip().lower()
    if selected == "smtp":
        return SMTPEmailProvider()
    return _default_local_provider
