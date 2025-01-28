export default {
  system:{
    yes: "确认",
    no: "取消",
  },
  systemmenu: {
    chat: "对话",
    settings: "设置"
  },
  historylist:{
    newchat: "新建会话",
    searchHistory: "搜索历史记录(回车)",
    delete: "确认删除？",
  },
  chatPage: {
    searchModel: "搜索模型...",
    stop:"停止生成",
    wait:"请等待当前对话完成",
    copysuccess: "复制成功",
    copyfailed: "复制失败",
    unVision:"当前模型不支持视觉，请选择其他模型",
    warning: "警告",
    delete: "确定要删除这组对话吗？",
    deletesuccess: "删除成功",
    deletefailed: "删除失败",
    pleaseWrite: "请输入消息 Enter发送, Shift+Enter换行",
    uploadfiles: "上传文件",
    uploadimages: "上传图片",
    gettingConnected: "连接网络",
    disconnect: "断开连接",
    onlyimage:"只允许上传图片文件",
    only4image:"只允许上传4张图片",
    unimage:"图片文件请使用图片上传按钮",
    only4files:"只允许上传4个文件"
  },
  settingMenu: {
    preferences:"偏好设置",
    modelsetting:"模型设置",
    advanced:"高级设置",
    savesuccess:"保存成功",
    searchengine:"搜索引擎",
  },
  preferences:{
    stream:"流式响应",
    streaminfo:"开启后将逐字显示 AI 的回复内容",
    autoscroll:"自动滚动",
    autoscrollinfo:"开启后将自动滚动到最新的对话内容",
    automaticmodelswitching:"自动切换模型",
    automaticmodelswitchinginfo:"开启后将根据对话内容自动切换合适的模型",
    historylength:"历史记录长度",
    historylengthinfo:"发送给 AI 的历史对话数量",
    save:"保存设置"
  },
  modelsetting:{
      addchannel:"新建渠道",
      addmodel:"添加模型",
      editchannel:"编辑渠道",
      editmodel:"编辑模型",
      nothavemodel:"暂无模型",
      edit:"编辑",
      delete:"删除",
      enable:"启用",
      disable:"禁用",
      visionModel:"视觉模型",
      textModel:"文本模型",
      modelNick:"模型昵称",
      modelName:"模型名称",
      selectChannel: "选择渠道",
      newurl: "重写代理地址",
      newapikey: "重写API Key",
      channelCode: "渠道编码",
      channelName: "渠道名称",
      baseurl: "代理地址",
      apikey: "API密钥",
      channelimage: "渠道图标",
      selectchannelimage: "选择渠道图标",
      deletechannel: "删除渠道",
      deletechannelconfirm: "删除渠道将同时删除该渠道下的所有模型，是否继续？",
      deletemodel: "删除模型",
      deletemodelconfirm: "确定要删除这个模型吗？",
      uploadicon: "请上传渠道图标",
      channelexist: "该渠道已存在，请选择其他渠道",
      addchannelsuccess: "添加渠道成功",
      addchannelfailed: "添加渠道失败",
      updatechannelsuccess: "更新渠道成功",
      updatechannelfailed: "更新渠道失败",
      deletechannelsuccess: "删除渠道成功",
      deletechannelfailed: "删除渠道失败",
      addmodelsuccess: "添加模型成功",
      addmodelfailed: "添加模型失败",
      updatemodelsuccess: "更新模型成功",
      updatemodelfailed: "更新模型失败",
      deletemodelsucess: "删除模型成功",
      deletemodelfailed: "删除模型失败",
      updateordersuccess: "更新顺序成功",
      updateorderfailed: "更新顺序失败",
      nomodels: "暂无模型"
  },
  advanced: {
    title: "高级设置",
    enable: "启用高级设置",
    enableHint: "开启后将使用以下自定义参数进行对话",
    temperatureHint: "值越高，回答越随机创造性；值越低，回答越确定性",
    topPHint: "影响输出文本的多样性",
    maxTokensHint: "单次交互最大 Token 数量",
    presencePenaltyHint: "值越高，越倾向于讨论新话题",
    frequencyPenaltyHint: "值越高，越倾向于减少重复用语",
    save: "保存设置"
  },
  "searchengine": {
    "editconfig": "编辑配置",
    "key": "键",
    "value": "值",
    "noconfig": "无需配置",
    "updateconfigsuccess": "配置更新成功",
    "updateconfigfailed": "配置更新失败",
    "updateordersuccess": "排序更新成功",
    "updateorderfailed": "排序更新失败"
  }
}
