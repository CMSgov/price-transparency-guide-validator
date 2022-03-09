# Test /data-files/allowed-amounts.json against the allowed amounts schema.
import subprocess

# check for exceptions thrown by a run of the validator
def test_allowed_amounts_raises_no_exception():
    cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts.json"]
    try:
        run = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except Exception as exc:
        assert False, f"'allowed-amounts.json' raised an exception {exc}"


# check to see if file passes validation
def test_allowed_amounts():
    cmd = ["../../validator", "../../schemas/allowed-amounts.json", "../../data-files/allowed-amounts.json"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)  # only set shell=True when cmd is one arg not a list.
    output, error = run.communicate()
    # print("input: ", run.stdin)   These are for debugging, leaving for future test implementations to take advantage of
    # print("output: ", output)
    # print("stderr: ", error)
    # print("run: ", run)
    assert output == "Input JSON is valid.\n"
