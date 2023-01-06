export default {
  data () {
    return {
      FPS60: 60,
      SCROLL_TOP_POSITION: 5,
      currentScrollY: 0
    }
  },
  mounted () {
    this.setCurrentScrollPositionY()
    document.addEventListener('scroll', this.setCurrentScrollPositionY)
  },
  methods: {
    setCurrentScrollPositionY () {
      this.currentScrollY = window.scrollY
    }
  }
}
