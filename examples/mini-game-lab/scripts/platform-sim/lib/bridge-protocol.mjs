export class BridgeProtocol {
  constructor(cdp) {
    this.cdp = cdp;
  }

  async command(name, params = {}) {
    await this.cdp.evaluate(`window.__sim.command(${JSON.stringify(name)}, ${JSON.stringify(params)})`);
  }

  async waitForEvent(name, { requestId, timeoutMs = 15000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await this.cdp.evaluate(`window.__sim.takeEvent(${JSON.stringify(name)}, ${JSON.stringify(requestId ?? null)})`);
      if (value) return value;
      await delay(100);
    }
    const trace = await this.trace();
    throw new Error(`wait_for_event_timeout:${name}:${requestId ?? ''}\n${JSON.stringify(trace, null, 2)}`);
  }

  async waitForMessage(type, predicateSource, { timeoutMs = 15000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await this.cdp.evaluate(`window.__sim.takeMessage(${JSON.stringify(type)}, ${JSON.stringify(predicateSource)})`);
      if (value) return value;
      await delay(100);
    }
    const trace = await this.trace();
    throw new Error(`wait_for_message_timeout:${type}\n${JSON.stringify(trace, null, 2)}`);
  }

  async expectCommandCompleted(command, requestId, timeoutMs = 15000) {
    const completed = await this.waitForEvent('mock.command.completed', { requestId, timeoutMs });
    if (completed.command !== command) {
      throw new Error(`unexpected_command_completed:${completed.command}`);
    }
    return completed;
  }

  async trace() {
    return this.cdp.evaluate('window.__sim.trace()');
  }

  async state() {
    return this.cdp.evaluate('window.__sim.state()');
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
