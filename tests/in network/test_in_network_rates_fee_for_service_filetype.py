# Test data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson against its schema. 
import subprocess

# check for exceptions on running the tool
def test_in_network_rates_filetype_raises_no_exception():
    cmd = ["../../validator", "../../schemas/in-network-rates.json", "../../data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson"]
    try:
        run = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    except Exception as exc:
        assert False, f"'in-network-rates-fee-for-service-sample-fhirized.ndjson' raised an exception {exc}"

# check if it validates successfully. 1 == failure.
def test_in_network_rates_filetype():
    cmd = ["../../validator", "../../schemas/in-network-rates.json", "../../data-files/in-network-rates-fee-for-service-sample-fhirized.ndjson"]
    run = subprocess.Popen(cmd, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    run.communicate()
    assert run.returncode == 1