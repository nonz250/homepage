<template>
  <div>
    <div class="graph">
      <div class="profile-container content">
        <div class="profile-image-container">
           <profile-images />
        </div>
        <div class="profile-messages-container">
          <div class="profile-messages">
            <p>
              <!-- <a
                href="#"
                class="message hover-underline"
                :class="{active: active1}"
                @click.prevent=""
                @contextmenu.prevent=""
              >
                何かを作ることがとても好きです。
              </a> -->
            </p>
            <p>
              <!-- <a
                href="#"
                class="message hover-underline"
                :class="{active: active2}"
                @click.prevent=""
                @contextmenu.prevent=""
              >
                私の制作物や技術で皆様を少しでも笑顔にしたり、楽にしたりすることで
              </a> -->
            </p>
            <p>
              <!-- <a
                href="#"
                class="message hover-underline"
                :class="{active: active3}"
                @click.prevent=""
                @contextmenu.prevent=""
              >
                より社会を豊かにできればと考え、日々精進して参ります。
              </a> -->
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="parallax-bg">
      <div class="profile-main-container content">
        <div id="about" class="profile-main">
          <h1 class="my-name">
            保坂　望
          </h1>

          <span class="my-name-en">Nozomi Hosaka</span>

          <div>
            <anchor link="https://github.com/nonz250" :shine="false">
              <font-awesome-icon :icon="['fab', 'github']" class="sns-icon github" />
            </anchor>
            <anchor link="https://twitter.com/nonz250" :shine="false">
              <font-awesome-icon :icon="['fab', 'twitter']" class="sns-icon twitter" />
            </anchor>
          </div>
        </div>

        <div class="profile-description">
          <p>
            💼&nbsp;&nbsp;<anchor link="https://binc.jp/">
              BASE, Inc.
            </anchor>
            /
            <anchor link="https://pay.co.jp/">
              PAY, Inc.
            </anchor>
          </p>
          <p>🔧&nbsp;&nbsp;Web Application Engineer</p>
          <p>✍&nbsp;&nbsp;Python / PHP / Laravel / CakePHP / JavaScript / Vue.js / Nuxt.js / etc ...</p>
          <p>🏍&nbsp;&nbsp;VULCAN S / Z250</p>
          <p>🎾&nbsp;&nbsp;Tennis</p>
        </div>

        <p>
          大阪の小さな医薬系ソフトウェアハウスを経て、
          <anchor link="https://corp.smaregi.jp/">
            Smaregi,Inc.
          </anchor>
          にてPHPを用いたバックエンドを中心に、Vue.js / Nuxt.jsによるフロントエンドも担当。その後、
          <anchor link="https://binc.jp/">
            BASE, Inc.
          </anchor>
          /
          <anchor link="https://pay.co.jp/">
            PAY, Inc.
          </anchor>
          にてPythonによる決済関係のバックエンドに従事。
        </p>
        <p>
          個人では自作アプリ制作、副業でもアプリ開発やメンター活動などを行っており、日常的にプログラミングに携わっています。<br>
        </p>

        <p>
          ✉️&nbsp;&nbsp;<anchor link="mailto:hosaka.non.work@gmail.com">
            hosaka.non.work@gmail.com
          </anchor>
        </p>
      </div>
    </div>

    <div class="graph">
      <section id="service" class="section content pt-1">
        <h2>Service</h2>
        <div class="service-container">
          <service title="プログラミング開発支援" icon="code">
            <p>PHP / JavaScript で開発のお手伝いをさせていただきます。</p>
            <p>フレームワークは問いませんが、Laravel / Vue.js / Nuxt.js ならよりスムースに事が進みます。</p>
            <p>設計には十分注意して開発するように心がけております。習得技術についてはご相談時にご確認ください。</p>
            <p>開発支援だけでなく、アプリ制作も承っております。</p>
            <p>ご依頼は直接DMで承っております。</p>
            <p>
              <anchor link="mailto:hosaka.non.work@gmail.com">
                hosaka.non.work@gmail.com
              </anchor>
            </p>
          </service>
          <service title="プログラミングレクチャー" icon="menu_book">
            <p>PHP / JavaScript などのプログラミング言語の習得のお手伝いをさせていただきます。</p>
            <p>フレームワークは Laravel / Vue.js / Nuxt.js などを対象にしています。</p>
            <p>また、業務支援のためのGAS(Google App Script)や、お子様向けのScratchも承っております。</p>
            <p>その他についてはご相談時にご確認ください。</p>
            <p class="vertical">
              <span class="trend">人気商品</span>
              <span class="material-icons-outlined trend">
                trending_up
              </span>
              &nbsp;&nbsp;<anchor link="https://coconala.com/users/1484531/reviews">
                過去の評価はこちら
              </anchor>
              <br>
            </p>
            <p>
              <small>※現在、ココナラでの出品を取りやめております。</small>
            </p>
            <p>
              <anchor link="mailto:hosaka.non.work@gmail.com">
                hosaka.non.work@gmail.com
              </anchor>
            </p>
          </service>
        </div>
      </section>
    </div>

    <div class="parallax-bg">
      <section id="works" class="section content pt-1">
        <h2>Works</h2>
        <div class="works">
          <work name="PAY.JP" image-path="images/payjp.webp" link="https://pay.jp/" />
          <work name="スマレジ・デベロッパーズ" image-path="images/smaregi-developers.webp" link="https://developers.smaregi.jp/" />
          <work name="スマレジ・アプリマーケット" image-path="images/smaregi-app-market.webp" link="https://apps.smaregi.jp/" />
          <work name="スマレジ・POS" image-path="images/smaregi.webp" link="https://smaregi.jp/" />
          <work name="Revolver" image-path="images/revolver.webp" link="https://revolver.biz/" />
          <work name="のんラボ" image-path="images/nons-labo.webp" link="https://labo.nozomi.bike/" attention="私の自作ブログです。" />
          <work name="今年の抱負メーカー" image-path="images/ambition.webp" link="https://ambition.nozomi.bike/" />
          <work name="旧: Nozomi Hosaka" image-path="images/old_portfolio.webp" link="https://portfolio.nozomi.bike/" />
        </div>
      </section>
    </div>

    <div class="graph">
      <section id="contact" class="section content">
        <h2>Contact me</h2>
        <div class="contact-container">
          <p>
            <!-- <a
              href="#"
              class="hover-underline"
              :class="{active: contactActive}"
              @click.prevent=""
              @contextmenu.prevent=""
            >
              仕事のご依頼や、ご相談などはお気軽にお問い合わせくださいませ。
            </a> -->
          </p>

          <anchor link="https://twitter.com/nonz250" :shine="false">
            <font-awesome-icon :icon="['fab', 'twitter']" class="sns-icon twitter" />
          </anchor>

          <anchor link="mailto:hosaka.non.work@gmail.com">
            hosaka.non.work@gmail.com
          </anchor>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import Anchor from "~/components/atoms/Anchor";
import ProfileImages from '~/components/parts/ProfileImages'
import Service from '~/components/parts/Service'
import Work from '~/components/parts/Work'

const currentScrollY = ref<number>(0)

const setCurrentScrollPositionY = () => {
  currentScrollY.value = window.scrollY
}

const FPS = ref<number>(60)
const active1 = ref<boolean>(false)
const active2 = ref<boolean>(false)
const active3 = ref<boolean>(false)
const contactActive = ref<boolean>(false)

const runDrawUnderLine = () => {
  setTimeout(() => {
    active1.value = true
    setTimeout(() => {
      active2.value = true
      setTimeout(() => {
        active3.value = true
      }, 2000)
    }, 2000)
  }, 1000)
}

const resetUnderLine = () => {
  active1.value = false
  active2.value = false
  active3.value = false
}

const setContactActive = () => {
  contactActive.value = currentScrollY.value >= document.body.scrollHeight - window.innerHeight
}

onMounted(() => {
  setCurrentScrollPositionY()
  runDrawUnderLine()
  setInterval(() => {
    resetUnderLine()
    runDrawUnderLine()
  }, 15000)
  setInterval(() => {
    setContactActive()
  }, 1500)
})
</script>

<style scoped lang="scss">
@import "assets/scss/variables";

.profile-container {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  justify-items: center;
  align-items: center;

  > .profile-image-container {
  }

  > .profile-messages-container {
    height: 100%;
    display: grid;
    place-items: center;
    padding: 0 2rem;

    @media screen and (max-width: 600px) {
      padding: 0;
    }

    > .profile-messages {
      > p {
        .message {
          font-size: 1.1rem;
          font-style: italic;
          line-height: 1.7;
          letter-spacing: .3rem;
        }
      }
    }
  }
}

.profile-main-container {
  margin-top: 3rem;

  > .profile-main {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  > .profile-description {
    margin-top: 1rem;
    display: grid;
    gap: .5rem;
    grid-template-columns: repeat(auto-fit, minmax($item-size, 1fr));

    > p {
      margin: 0;
      padding: 0;
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
  margin: 0 1rem 0 0;
  padding: 0;
  font-size: 2rem;
  font-weight: normal;

  &-en {
    margin: 0 1rem 0 0;
    font-size: 1.5rem;
  }
}

.section {
  > .service-container, > .works {
    padding-bottom: 2rem;
    display: grid;
    gap: 2rem;
    grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));
    justify-items: center;
  }

  > .contact-container {
  }
}

.trend {
  color: $red;
}
</style>
