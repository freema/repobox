.PHONY: build test lint clean run

BINARY_NAME=runner
BUILD_DIR=./bin

build:
	go build -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/runner

run: build
	$(BUILD_DIR)/$(BINARY_NAME)

test:
	go test -v ./...

lint:
	golangci-lint run

clean:
	rm -rf $(BUILD_DIR)
	go clean

tidy:
	go mod tidy

.DEFAULT_GOAL := build
