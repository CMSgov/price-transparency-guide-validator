# Test /data-files/allowed-amounts.json against the allowed amounts schema.
import subprocess

# check for exceptions thrown by the file itself
def test_schema_raises_no_exception():
    try:
        schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts.json"])
    except Exception as exc:
        assert False, f"'allowed-amounts.json' raised an exception {exc}"

# check if it validates successfully. 0 == success. 
def test_allowed_amounts():
    schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts.json"])
    assert schema_test_outcome == 0