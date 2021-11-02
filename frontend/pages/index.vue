<template>
  <main>
    <div class="profile-container">
      <div class="profile-image-container">
        <profile-images />
      </div>
      <div class="profile-main-container">
        <div class="profile-main">
          <h1 class="my-name">
            保坂　望
          </h1>
          <div>
            <anchor link="https://github.com/nonz250">
              <font-awesome-icon :icon="['fab', 'github']" class="sns-icon github" />
            </anchor>
            <anchor link="https://twitter.com/nonz250">
              <font-awesome-icon :icon="['fab', 'twitter']" class="sns-icon twitter" />
            </anchor>
          </div>
        </div>

        <div class="profile-sub">
          <span class="my-name-en">Nozomi Hosaka</span>
        </div>

        <div class="profile-description">
          <p>🔧&nbsp;&nbsp;Web Application Engineer (PHPer)</p>
          <p>✍&nbsp;&nbsp;PHP / Laravel / CakePHP / JavaScript / Vue.js / etc...</p>
          <p>🏍&nbsp;&nbsp;VULCAN S / Z250</p>
          <p>🎾&nbsp;&nbsp;Tennis</p>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
import Anchor from '~/components/atoms/Anchor'
import ProfileImages from '~/components/parts/ProfileImages'

export default {
  components: { ProfileImages, Anchor }
}
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.profile-container {
  display: flex;

  > .profile-image-container {
    margin-right: 3rem;
  }

  > .profile-main-container {
    > .profile-main {
      display: flex;
      align-items: flex-end;
    }

    > .profile-sub {
      margin-bottom: 1rem;
    }

    > .name {
      margin-bottom: 1rem;
    }
  }
}

.sns {
  &-icon {
    font-size: 1.2rem;
    margin-right: .5rem;

    &.twitter {
      color: $twitter-blue !important;
    }

    &.github {
      color: $black !important;
    }
  }

  &-account {
    display: flex;
    justify-content: flex-start;
    align-items: center;
  }
}

.my-name {
  margin: 0;
  padding: 0;
  font-size: 2rem;
  font-weight: normal;
  margin-right: 1rem;

  &-en {
    font-size: 1.5rem;
  }
}
</style>
