import csv
import io
from typing import Any, Dict, Iterable, List, Sequence


def sanitize_csv_cell(value: Any) -> Any:
    """
    Sanitizes a CSV cell to prevent formula injection attacks (CSV Injection / CWE-1236).
    If a string value starts with formula characters (=, +, -, @, tab, newline, carriage return),
    prepend a single quote (') so spreadsheet applications evaluate the cell strictly as text.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        return value

    stripped = value.lstrip()
    if stripped and stripped[0] in ("=", "+", "-", "@", "\t", "\r", "\n"):
        return f"'{value}"
    return value


def generate_csv_stream(
    fieldnames: Sequence[str],
    rows: Iterable[Dict[str, Any]],
) -> io.StringIO:
    """
    Generates a safe in-memory CSV stream from an iterable of row dictionaries.
    Applies formula injection sanitization to all cell contents.
    """
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
    writer.writeheader()

    for row in rows:
        sanitized_row = {
            k: sanitize_csv_cell(row.get(k, ""))
            for k in fieldnames
        }
        writer.writerow(sanitized_row)

    output.seek(0)
    return output
