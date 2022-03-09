# Test data-files/prescription-drugs.json against the prescription drugs schema.
import subprocess

# check for exceptions
def test_prescription_drugs_raises_no_exception():
    cmd = ["../../validator", "../../schemas/prescription-drugs.json", "../../data-files/prescription-drugs.json"]
    try:
        run = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except Exception as exc:
        assert False, f"'in-network-rates-capitation-sample.json' raised an exception {exc}"

# check if it validates successfully. 0 == success.
def test_prescription_drugs():
    cmd = ["../../validator", "../../schemas/prescription-drugs.json", "../../data-files/prescription-drugs.json"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run.communicate()
    assert run.returncode == 0