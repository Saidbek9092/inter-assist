export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null

  async startRecording() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.mediaRecorder = new MediaRecorder(this.stream)
      this.audioChunks = []

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }

      this.mediaRecorder.start()
      return true
    } catch (error) {
      console.error('Error starting recording:', error)
      return false
    }
  }

  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || !this.stream) {
      return null
    }

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' })
        this.cleanup()
        resolve(audioBlob)
      }

      this.mediaRecorder!.stop()
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop())
      }
    })
  }

  private cleanup() {
    this.mediaRecorder = null
    this.stream = null
    this.audioChunks = []
  }
} 