"use strict";

const fs = require("fs");
const proc = require("child_process");

const chai = require("chai");
const Error = require("errno-codes");
const proxyquire = require("proxyquire");
const sinon = require("sinon");
const sinonTest = require("sinon-test");
const test = sinonTest(sinon);
const sinonChai = require("sinon-chai");

const jocker = require("..");

const should = chai.should();
const plugins = { sinon: sinonChai };

chai.use(plugins.sinon);

describe("exec", function () {
  // errors
  let UNKNOWN = Error.get(Error.UNKNOWN);
  let ENOENT = Error.get(Error.ENOENT);
  let ENOTDIR = Error.get(Error.ENOTDIR);

  it("should be a function", function () {
    jocker.exec.should.be.a("function");
  });

  it(
    "should make stat call for the HOME argument",
    test(function () {
      let stat = this.spy(fs, "stat");
      let callback = this.spy();

      jocker.exec("/home", "/init", callback);

      stat.should.have.been.calledWithExactly("/home", sinon.match.func);
    })
  );

  it(
    "should return every error excluding ENOENT on homeStat",
    test(function () {
      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat.withArgs("/home", sinon.match.func).yields(UNKNOWN);

      jocker.exec("/home", "/init", callback);

      callback.should.have.been.calledWith(UNKNOWN);
    })
  );

  it(
    'should return "path not found" for ENOENT errors',
    test(function () {
      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat.withArgs("/home", sinon.match.func).yields(ENOENT);

      jocker.exec("/home", "/init", callback);

      callback.should.have.been.calledWithExactly(`/home not found`);
    })
  );

  it(
    "should make a stat call for the init file",
    test(function () {
      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat
        .withArgs("/home", sinon.match.func)
        .yields(null, { isFile: sinon.stub().returns(false) });
      stat
        .withArgs("/home/init", sinon.match.func)
        .yields(null, { isFile: sinon.stub().returns(true) });

      jocker.exec("/home", "/init", callback);

      stat.should.have.been.calledWithExactly("/home", sinon.match.func);
      stat.should.have.been.calledWithExactly("/home/init", sinon.match.func);
    })
  );

  it(
    "should return every error excluding ENOENT on initStat",
    test(function () {
      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat
        .withArgs("/home", sinon.match.func)
        .yields(null, { isFile: sinon.stub().returns(false) });
      stat.withArgs("/home/init", sinon.match.func).yields(UNKNOWN);

      jocker.exec("/home", "/init", callback);

      callback.should.have.been.calledWith(UNKNOWN);
    })
  );

  it(
    'should return "path not found" for ENOENT errors',
    test(function () {
      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat
        .withArgs("/home", sinon.match.func)
        .yields(null, { isFile: sinon.stub().returns(false) });
      stat.withArgs("/home/init", sinon.match.func).yields(ENOENT);

      jocker.exec("/home", "/init", callback);

      callback.should.have.been.calledWithExactly(`/home/init not found`);
    })
  );

  it(
    "should check if the init stat is a file and return the callback with an error",
    test(function () {
      let homeStat = { gid: 0, uid: 0 };
      let initStat = {
        gid: undefined,
        uid: undefined,
        isFile: sinon.stub().returns(false),
      };

      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat.withArgs("/home", sinon.match.func).yields(null, homeStat);
      stat.withArgs("/home/init", sinon.match.func).yields(null, initStat);

      jocker.exec("/home", "/init", callback);

      initStat.isFile.should.have.been.calledOnce;
      callback.should.have.been.calledWithExactly("/home/init is not a file");
    })
  );

  it(
    "should check if the home stat and the init stat have the same gid uid",
    test(function () {
      let homeStat = { gid: 0, uid: 0 };
      let initStat = { gid: 1, uid: 1, isFile: sinon.stub().returns(true) };

      let stat = this.stub(fs, "stat");
      let callback = this.spy();

      stat.withArgs("/home", sinon.match.func).yields(null, homeStat);
      stat.withArgs("/home/init", sinon.match.func).yields(null, initStat);

      jocker.exec("/home", "/init", callback);

      callback.should.have.been.calledWithExactly(
        "/home uid & gid don't match with /init"
      );
    })
  );
  
  it(
    "should spawn the user init script",
    test(function () {
      let chrootSpawn = `${process.cwd()}/lib/chrootSpawn`;
      let context = { on: sinon.stub() };

      let callback = this.spy();

      let stat = this.stub(fs, "stat");
      let spawn = this.stub(proc, "spawn");
      let homeStat = { gid: 0, uid: 0 };
      let initStat = {
        gid: 0,
        uid: 0,
        mode: fs.constants.S_IXUSR,
        isFile: sinon.stub().returns(true),
      };

      stat.withArgs("/home", sinon.match.func).yields(null, homeStat);
      stat.withArgs("/home/init", sinon.match.func).yields(null, initStat);

      context.on.withArgs("exit", callback).returns();
      spawn
        .withArgs(chrootSpawn, [homeStat.uid, homeStat.gid, "/init"], {
          cwd: "/home",
          env: {},
          stdio: "inherit",
        })
        .returns(context);

      jocker.exec("/home", "/init", callback);

      spawn.should.have.been.calledWithExactly(
        chrootSpawn,
        [homeStat.uid, homeStat.gid, "/init"],
        { cwd: "/home", env: {}, stdio: "inherit" }
      );
      spawn.should.have.returned(context);
      context.on.should.have.been.calledOnce;
    })
  );
});
