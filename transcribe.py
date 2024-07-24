import time
import re
import pyaudio
import wave
import whisper
import openai

# OpenAI API 키 설정
openai.api_key = 's'

client = openai.OpenAI(
  api_key=''
)
assistant = client.beta.assistants.retrieve(
    assistant_id=''
)
thread = client.beta.threads.create()

def wait_on_run(run, thread):
    while run.status == "queued" or run.status == "in_progress":
        run = client.beta.threads.runs.retrieve(
            thread_id=thread.id,
            run_id=run.id,
        )
        time.sleep(0.5)
    return run

def get_response(content):
    message = client.beta.threads.messages.create(
        thread_id=thread.id,
        role='user',
        content=content
    )

    # Execute our run
    run = client.beta.threads.runs.create(
        thread_id=thread.id,
        assistant_id=assistant.id,
    )

    # Wait for completion
    wait_on_run(run, thread)
    # Retrieve all the messages added after our last user message
    messages = client.beta.threads.messages.list(
        thread_id=thread.id, order="asc", after=message.id
    )
    response_text = ""
    for message in messages:
        for c in message.content:
            response_text += c.text.value
    clean_text = re.sub('【.*?】', '', response_text)
    return clean_text

def transcribe_directly():
    sample_rate = 16000
    bits_per_sample = 16
    chunk_size = 1024
    audio_format = pyaudio.paInt16
    channels = 1

    def callback(in_data, frame_count, time_info, status):
        wav_file.writeframes(in_data)
        return None, pyaudio.paContinue

    wav_file = wave.open('output.wav', 'wb')
    wav_file.setnchannels(channels)
    wav_file.setsampwidth(bits_per_sample // 8)
    wav_file.setframerate(sample_rate)

    audio = pyaudio.PyAudio()
    print("Press Enter to start recording...")
    input()
    stream = audio.open(format=audio_format,
                        channels=channels,
                        rate=sample_rate,
                        input=True,
                        frames_per_buffer=chunk_size,
                        stream_callback=callback)

    print("Press Enter to stop recording...")
    input()
    stream.stop_stream()
    stream.close()
    audio.terminate()

    wav_file.close()

    audio_file = open('output.wav', "rb")
    transcription = client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        response_format = "text",
        language="ko"
    )
    # print(transcription)
    return transcription

while True:
    content = transcribe_directly()
    print("Transcribed text:", content)

    response = get_response(content)
    print("GPT response:", response)
