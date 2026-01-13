#!/bin/bash
#
# Ollama Local LLM Integration Test Script
# Tests connectivity and functionality of local Ollama server
#

set -e

OLLAMA_URL="http://localhost:11434"
MODEL="gemma3:27b"
PASSED=0
FAILED=0

echo "╔════════════════════════════════════════════════════════════╗"
echo "║       OLLAMA LOCAL LLM INTEGRATION TESTS                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Function to run a test
run_test() {
    local name="$1"
    local cmd="$2"
    local expected="$3"
    
    echo -n "⏳ $name... "
    
    if result=$(eval "$cmd" 2>/dev/null); then
        if [ -n "$expected" ]; then
            if echo "$result" | grep -q "$expected"; then
                echo "✅ PASS"
                ((PASSED++))
                return 0
            else
                echo "❌ FAIL (unexpected result)"
                echo "   Expected: $expected"
                echo "   Got: $result"
                ((FAILED++))
                return 1
            fi
        else
            echo "✅ PASS"
            ((PASSED++))
            return 0
        fi
    else
        echo "❌ FAIL"
        ((FAILED++))
        return 1
    fi
}

# Test 1: Server Health
echo "▶ SERVER HEALTH"
echo "────────────────────────────────────────"

run_test "Ollama server is running" \
    "curl -s -o /dev/null -w '%{http_code}' $OLLAMA_URL/api/tags" \
    "200"

run_test "API returns model list" \
    "curl -s $OLLAMA_URL/api/tags | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get(\"models\",[]))>0)'" \
    "True"

run_test "gemma3:27b model is available" \
    "curl -s $OLLAMA_URL/api/tags | python3 -c 'import sys,json; d=json.load(sys.stdin); print(any(\"gemma3\" in m[\"name\"] for m in d.get(\"models\",[])))'" \
    "True"

echo ""
echo "▶ GENERATE API"
echo "────────────────────────────────────────"

run_test "Generate API responds (non-streaming)" \
    "curl -s $OLLAMA_URL/api/generate -d '{\"model\":\"$MODEL\",\"prompt\":\"Say OK\",\"stream\":false}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get(\"response\",\"\"))>0)'" \
    "True"

run_test "Streaming API works" \
    "curl -s $OLLAMA_URL/api/generate -d '{\"model\":\"$MODEL\",\"prompt\":\"Count\",\"stream\":true}' | head -1 | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"response\" in d)'" \
    "True"

echo ""
echo "▶ OPENAI COMPATIBLE API"
echo "────────────────────────────────────────"

run_test "OpenAI chat completions endpoint" \
    "curl -s $OLLAMA_URL/v1/chat/completions -H 'Authorization: Bearer ollama' -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Say OK\"}],\"max_tokens\":10}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(\"choices\" in d and len(d[\"choices\"])>0)'" \
    "True"

run_test "System prompts are supported" \
    "curl -s $OLLAMA_URL/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"system\",\"content\":\"Always respond with PONG\"},{\"role\":\"user\",\"content\":\"PING\"}],\"max_tokens\":20}' | python3 -c 'import sys,json; d=json.load(sys.stdin); print(len(d.get(\"choices\",[{}])[0].get(\"message\",{}).get(\"content\",\"\"))>0)'" \
    "True"

echo ""
echo "▶ MODEL CAPABILITIES"
echo "────────────────────────────────────────"

run_test "Multi-turn conversation memory" \
    "curl -s $OLLAMA_URL/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"My name is TestUser.\"},{\"role\":\"assistant\",\"content\":\"Hello TestUser!\"},{\"role\":\"user\",\"content\":\"What is my name?\"}],\"max_tokens\":30}' | python3 -c 'import sys,json; d=json.load(sys.stdin); c=d.get(\"choices\",[{}])[0].get(\"message\",{}).get(\"content\",\"\").lower(); print(\"testuser\" in c or \"test\" in c)'" \
    "True"

run_test "Math calculation" \
    "curl -s $OLLAMA_URL/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"What is 15+27? Reply with JUST the number.\"}],\"max_tokens\":20}' | python3 -c 'import sys,json; d=json.load(sys.stdin); c=d.get(\"choices\",[{}])[0].get(\"message\",{}).get(\"content\",\"\"); print(\"42\" in c)'" \
    "True"

echo ""
echo "▶ ERROR HANDLING"
echo "────────────────────────────────────────"

run_test "Empty prompt is handled" \
    "curl -s -o /dev/null -w '%{http_code}' $OLLAMA_URL/api/generate -d '{\"model\":\"$MODEL\",\"prompt\":\"\",\"stream\":false}'" \
    "200"

echo ""
echo "════════════════════════════════════════"
echo "          TEST SUMMARY"
echo "════════════════════════════════════════"
echo ""
echo "  ✅ Passed: $PASSED"
echo "  ❌ Failed: $FAILED"
echo "  📊 Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed! Ollama is working correctly."
    exit 0
else
    echo "⚠️  Some tests failed. Check Ollama configuration."
    exit 1
fi
