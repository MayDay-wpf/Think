<script setup>
import { ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
const router = useRouter();
const { t } = useI18n();
const activeMenu = ref('chat'); // 默认激活的菜单项

const handleMenuClick = (menu) => {
  activeMenu.value = menu;
  router.push({ name: menu }); // 使用路由跳转
};

// 添加页面刷新处理函数
// 修改刷新处理函数
const handleRefresh = async () => {
  const currentRoute = router.currentRoute.value;
  await router.replace({ path: '/refresh-page' });
  await nextTick();
  router.replace({
    path: currentRoute.path,
    query: currentRoute.query,
    hash: currentRoute.hash
  });
};
</script>

<template>
  <div class="system-menu">
    <div class="custom-titlebar"></div>
    <img src="../../assets/logo.png" alt="logo" class="logo">
    <el-menu :default-active="activeMenu" class="el-menu-vertical-demo" :collapse="false" :unique-opened="true">
      <div class="menu-top">
        <el-menu-item index="chat" @click="handleMenuClick('chat')">
          <el-tooltip effect="dark" :content="t('systemmenu.chat')" placement="right">
            <i class="ri-message-3-line"></i>
          </el-tooltip>
        </el-menu-item>
        <el-menu-item index="settings" @click="handleMenuClick('settings')">
          <el-tooltip effect="dark" :content="t('systemmenu.settings')" placement="right">
            <i class="ri-settings-4-line"></i>
          </el-tooltip>
        </el-menu-item>
        <el-menu-item index="statistics" @click="handleMenuClick('statistics')">
          <el-tooltip effect="dark" :content="t('systemmenu.statistics')" placement="right">
            <i class="ri-bar-chart-2-line"></i>
          </el-tooltip>
        </el-menu-item>
      </div>
      <div class="menu-bottom">
        <el-menu-item @click="handleRefresh">
          <el-tooltip effect="dark" :content="t('systemmenu.refresh')" placement="right">
            <i class="ri-loop-left-line"></i>
          </el-tooltip>
        </el-menu-item>
      </div>
    </el-menu>
  </div>
</template>

<style scoped>
.custom-titlebar {
  margin-bottom: 30px;
  -webkit-app-region: drag;
}

.logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
  -webkit-app-region: drag;
  margin: 5px auto;
}

.system-menu {
  width: 65px;
  height: 100vh;
  background-color: var(--el-bg-color-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-right: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  -webkit-app-region: drag;
  position: relative;
  z-index: 1000;
}

.el-menu-vertical-demo {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: transparent;
  border-right: none;
  height: calc(100vh - 60px);
}

.menu-top,
.menu-bottom {
  display: flex;
  flex-direction: column;
}

.el-menu-item {
  background: transparent !important;
}

.system-menu ul li {
  -webkit-app-region: no-drag;
}

.language-selector i {
  margin-right: 5px;
}

.el-menu-vertical-demo {
  border-right: none;
  height: calc(100vh - 60px);
}

.el-menu-item i {
  font-size: 24px;
}
</style>
