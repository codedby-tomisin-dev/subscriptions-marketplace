from pathlib import Path
import importlib
import inspect


def discover_handlers() -> dict:
    """
    Scans the `modules/` directory for `handlers.py` files.
    Imports each one and returns a dictionary of all decorated
    Firebase functions found within them, so they can be exported.
    """
    discovered_functions = {}
    modules_dir = Path(__file__).parent / "modules"

    if not modules_dir.exists():
        return discovered_functions

    for handler_file in modules_dir.glob("*/handlers.py"):
        # Convert path `modules/product/handlers.py` to module string `modules.product.handlers`
        domain_name = handler_file.parent.name
        module_name = f"modules.{domain_name}.handlers"

        # Import the module
        module = importlib.import_module(module_name)

        # Find all functions in the module
        for name, obj in inspect.getmembers(module):
            # Firebase decorators add a `__firebase_endpoint__` attribute
            if inspect.isfunction(obj) and hasattr(obj, "__firebase_endpoint__"):
                # Export directly using the function's native name since
                # Firebase strictly looks for a matching '__name__' internally.
                discovered_functions[name] = obj

    return discovered_functions
