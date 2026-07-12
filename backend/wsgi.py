from dotenv import load_dotenv
load_dotenv()

from jarvis.web.app import create_app
app = create_app()
