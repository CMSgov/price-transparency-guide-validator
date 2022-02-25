import subprocess

test_outcome = subprocess.call(["/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/validator", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/schemas/allowed-amounts/allowed-amounts.json", "/home/runner/work/price-transparency-guide-validator/price-transparency-guide-validator/data-files/allowed-amounts.json"])

def test_allowed_amounts():
    assert test_outcome == 0