# Free-tier Spaces only allow Gradio on ZeroGPU, so the existing FastAPI app is mounted on a
# gr.Server (Gradio's FastAPI subclass) that the HF runtime launches as `demo`.
import spaces  # must be imported before torch

import threading

import gradio as gr

from app.main import _warm_up, app as api

API_PREFIX = "/v1"  # gradio's own routes live at the root; the frontend base URL ends in /v1


@spaces.GPU(duration=1)
def _noop() -> None:  # ZeroGPU requires one decorated function; never called
    pass


# gr.Server.launch() replaces the app lifespan, so warm up the model here instead
threading.Thread(target=_warm_up, daemon=True).start()

demo = gr.Server(title="Cry for your Mom API")
demo.mount(API_PREFIX, api)

if __name__ == "__main__":
    demo.launch()
