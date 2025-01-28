<script setup>
import { ref, watch } from 'vue';
import { ElMenu, ElMenuItem } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight } from '@element-plus/icons-vue' 

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});

const router = useRouter();
const route = useRoute();
const activeItem = ref('general'); // 默认设置为 general

// 监听路由变化，更新激活项
watch(() => route.name, (newName) => {
  if (newName) {
    activeItem.value = newName;
  }
});

const handleSelect = (key) => {
  router.push({ name: key });
};
</script>


<template>
  <div class="setting-menu">
    <ElMenu :default-active="activeItem" mode="vertical" @select="handleSelect">
      <ElMenuItem v-for="item in items" :key="item.key" :index="item.key">
        <i :class="item.icon"></i>
        <span>{{ item.label }}</span>
        <el-icon class="arrow-icon"><ArrowRight /></el-icon>
      </ElMenuItem>
    </ElMenu>
  </div>
</template>

<style scoped>
.setting-menu {
  width: 200px;
  border-right: 1px solid var(--el-border-color-light);
  background-color: var(--el-bg-color);
}
.el-menu {
  border: none;
}
.arrow-icon {
  position: absolute;
  right: 0;
}
</style>
