# Test data-files/allowed-amounts-empty.json against its schema 
import subprocess

# check for exceptions
def test_allowed_amounts_empty_raises_no_exception():
    cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts-empty.json.json"]
    try:
        run = subprocess.Popen(cmd, shell=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except Exception as exc:
        assert False, f"Running tool with 'allowed-amounts-empty.json' raised an exception {exc}"

# # test to make sure this one failed the validator. 1 == failure.
# def test_allowed_amounts_empty():
#     cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts-empty.json"]
#     run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE) 
#     run.communicate()
#     assert run.returncode  == 1