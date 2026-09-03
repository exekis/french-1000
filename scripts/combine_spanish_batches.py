import json
import os

all_words = []
for i in range(1, 6):
    path = f"data/local/spanish-batch-{i}.json"
    with open(path, "r", encoding="utf-8") as f:
        batch = json.load(f)
    print(f"Batch {i}: {len(batch)} items, ranks {batch[0]['rank']} to {batch[-1]['rank']}")
    all_words.extend(batch)

print(f"Total items across all 5 batches: {len(all_words)}")
assert len(all_words) == 1000, f"Expected 1000 items, got {len(all_words)}"

for idx, w in enumerate(all_words):
    expected_rank = idx + 1
    expected_id = f"{expected_rank:04d}"
    assert w["rank"] == expected_rank, f"Rank mismatch at index {idx}: expected {expected_rank}, got {w['rank']}"
    assert w["id"] == expected_id, f"ID mismatch at index {idx}: expected {expected_id}, got {w['id']}"
    assert "spanish" in w and len(w["spanish"]) > 0
    assert "english" in w and len(w["english"]) > 0
    assert "persian" in w and len(w["persian"]) > 0
    assert "exampleSpanish" in w and len(w["exampleSpanish"]) > 0
    assert "exampleTarget" in w and len(w["exampleTarget"]) > 0
    assert "pronunciationTarget" in w and len(w["pronunciationTarget"]) > 0
    assert "audio" in w
    assert "review" in w

os.makedirs("src/data/spanish", exist_ok=True)
output_path = "src/data/spanish/words.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(all_words, f, ensure_ascii=False, indent=2)

print(f"Saved {len(all_words)} words to {output_path} successfully!")
