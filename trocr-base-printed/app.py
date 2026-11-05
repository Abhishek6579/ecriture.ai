"""Entry point for the trocr-base-printed image: the backend's FastAPI app, with ONNX Runtime
sessions opened in low-memory mode (no weight prepacking, no CPU arena). The engine doesn't
expose session options; this saves ~430 MB so the image fits a 2 GB instance."""
import os

import onnxruntime as ort
from optimum.onnxruntime import ORTModelForVision2Seq

_from_pretrained = ORTModelForVision2Seq.from_pretrained.__func__


def _low_memory_from_pretrained(cls, *args, **kwargs):
    options = ort.SessionOptions()
    options.enable_cpu_mem_arena = os.getenv("ORT_MEM_ARENA", "0") == "1"
    options.add_session_config_entry("session.disable_prepacking", os.getenv("ORT_DISABLE_PREPACKING", "1"))
    kwargs.setdefault("session_options", options)
    return _from_pretrained(cls, *args, **kwargs)


# Must run before main's lifespan builds FullPageOCR, which imports this class lazily.
ORTModelForVision2Seq.from_pretrained = classmethod(_low_memory_from_pretrained)

from main import app  # noqa: E402, F401
