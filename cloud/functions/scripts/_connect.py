"""Shared setup for the dev scripts: connect firebase_admin to the emulators or a real project."""
import argparse
import os

import firebase_admin

EMULATOR_HOSTS = {
    "FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080",
    "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:9099",
}


def add_connection_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--project", default="subscription-business-511510", help="Firebase project id (default: subscription-business-511510)")
    parser.add_argument("--live", action="store_true", help="Talk to the real project instead of the local emulators")


def connect(args: argparse.Namespace) -> None:
    if not args.live:
        # Hosts already in the environment win, for emulators on non-default ports.
        for name, host in EMULATOR_HOSTS.items():
            os.environ.setdefault(name, host)
    firebase_admin.initialize_app(options={"projectId": args.project})
