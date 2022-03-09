# Test data-files/allowed-amounts-borked.json against its schema
import subprocess

# #check for exceptions thrown by a run of the validator, this should not throw exceptions simply for running the tool
def test_allowed_amounts_borked_raises_no_exception():
    cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts-borked.json"]
    try:
        run = subprocess.Popen(cmd, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as exc:
        assert False, f"'allowed-amounts-borked.json' raised an exception {exc}"


# make sure borked json file fails validation
# 0 == successful, 1 == failure
def test_allowed_amounts_borked():
    cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts-borked.json"]
    run = subprocess.Popen(cmd, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run.communicate()
    assert run.returncode == 1