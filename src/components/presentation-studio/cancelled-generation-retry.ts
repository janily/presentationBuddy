export function requestsCancelledGenerationRetry(message: string) {
  const normalized = message.trim();

  return /(重新|再次|继续|接着|恢复).{0,8}(生成|做)|重试|再来一次|刚才.{0,8}(取消|停)|不小心.{0,8}(取消|停)/i.test(normalized);
}
