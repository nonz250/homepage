export default {
  methods: {
    async sleep (ms) {
      return await new Promise((resolve) => {
        setTimeout(resolve, ms)
      })
    }
  }
}
