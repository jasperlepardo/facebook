import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

os.environ.setdefault('PAYLOAD_BASE', 'https://facebook-lac.vercel.app')

from app import app
