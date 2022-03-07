# Test /data-files/allowed-amounts.json against the allowed amounts schema.
from os import chmod
import stat
import subprocess

# # check for exceptions thrown by a run of the validator
# def test_allowed_amounts_raises_no_exception():
#     try:
#         run = subprocess.Popen(
#             (["./validator", "../../schemas/allowed-amounts.json",
#              "../../data-files/allowed-amounts.json"]),
#             stdout=subprocess.PIPE,
#             stderr=subprocess.PIPE,
#             text=True
#         )
#     except Exception as exc:
#         assert False, f"'allowed-amounts.json' raised an exception {exc}"


# check to see if file passes validation
def test_allowed_amounts():
    cmd = ["sudo", "../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts.json"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)  # only set shell=True when cmd is one arg not a list.
    output, error= run.communicate()
    print("input: ", run.stdin)
    print("output: ", output)
    print("stderr: ", error)
    print("run: ", run)
    assert output == "Input JSON is valid.\n"
