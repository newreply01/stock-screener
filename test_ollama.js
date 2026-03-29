(async () => {
  const ollamaUrl = 'http://localhost:11434';
  const modelName = 'qwen3.5:9b';
  try {
    const response = await fetch(\/api/generate\, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        prompt: 'Hello',
        stream: false
      }),
      signal: AbortSignal.timeout(60000)
    });
    if (!response.ok) throw new Error(\Ollama API error: \);
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Ollama Test Failed:', err);
  }
})();
