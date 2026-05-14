killing port: lsof -i :3003 | awk 'NR>1 {print $2}' | xargs -r kill -9




 help me to
  implement the backend base
  on this file /home/rayu/both-safe/.kiro/specs/bothsafe-telegram-bot-mvp
  (implement
  base on that backend defined also because expect
  the backend will follow that api design too)  but to
  under your task clear in that spec please read this
  file first @.kiro/specs/Prompt.Format.md and
  @.kiro/specs/kiro-task-execution.prompt.md  because in
  this case you act as the kiro. implement task and
  update the task status.