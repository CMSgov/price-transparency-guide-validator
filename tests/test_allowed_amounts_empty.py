# Test data-files/allowed-amounts-empty.json against its schema 
import subprocess

# check for exceptions
def test_schema_raises_no_exception():
    try:
        schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts-empty.json"])
    except Exception as exc:
        assert False, f"'allowed-amounts-empty.json' raised an exception {exc}"

# test to make sure this one failed the validator. 1 == failure.
def test_allowed_amounts_borked():
    schema_test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts-empty.json"])
    assert schema_test_outcome == 1