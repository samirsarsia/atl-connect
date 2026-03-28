import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

from rag import load_resources_into_db

if __name__ == "__main__":
    load_resources_into_db(
        os.path.join(os.path.dirname(__file__), "resources.json")
    )
    print("Database seeded successfully!")
