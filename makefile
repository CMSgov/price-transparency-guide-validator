validator: schemavalidator.cpp
	g++ -O3 --std=c++17 -I ./rapidjson/include -I ./tclap/include/ schemavalidator.cpp -o validator -lstdc++fs
validatordebug: schemavalidator.cpp
	g++ -g --std=c++17 -I ./rapidjson/include -I ./tclap/include/ schemavalidator.cpp -o validator -lstdc++fs