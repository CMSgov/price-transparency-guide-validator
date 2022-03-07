# Test data-files/allowed-amounts-borked.json against its schema
import subprocess

# #check for exceptions thrown by a run of the validator
# def test_allowed_amounts_borked_raises_no_exception():
#     try:
#         run = subprocess.Popen(
#             (["./validator", "../../schemas/allowed-amounts.json",
#              "../../data-files/allowed-amounts-borked.json"]),
#             stdout=subprocess.PIPE,
#             stderr=subprocess.PIPE,
#             text=True
#         )
#     except Exception as exc:
#         assert False, f"'allowed-amounts-borked.json' raised an exception {exc}"


# make sure borked json file fails validation
# 0 == successful, 1 == failure
def test_allowed_amounts_borked():
    cmd = ["sudo", "../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts-borked.json"]
    run = subprocess.Popen(cmd, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run.communicate()
    assert run.returncode == 1