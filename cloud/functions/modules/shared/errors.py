class FailedPrecondition(Exception):
    """The request is valid, but the current state doesn't allow it (e.g. resuming a sub that isn't paused).

    `traced_call` maps it to FAILED_PRECONDITION; the message is shown to the user.
    """
