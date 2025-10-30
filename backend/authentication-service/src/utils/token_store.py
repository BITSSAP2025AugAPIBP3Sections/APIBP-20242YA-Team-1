import os
import pickle

class TokenStore:
    TOKEN_PATH = "tokens"

    @classmethod
    def _get_user_token_path(cls, user_email):
        os.makedirs(cls.TOKEN_PATH, exist_ok=True)
        return os.path.join(cls.TOKEN_PATH, f"{user_email}_token.pickle")

    @classmethod
    def save_token(cls, user_email, creds):
        with open(cls._get_user_token_path(user_email), "wb") as token_file:
            pickle.dump(creds, token_file)

    @classmethod
    def load_token(cls, user_email):
        path = cls._get_user_token_path(user_email)
        if os.path.exists(path):
            with open(path, "rb") as token_file:
                return pickle.load(token_file)
        return None
