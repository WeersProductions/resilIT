// require('dotenv').config()

const gulp = require('gulp')
const nodemon = require('gulp-nodemon')
const livereload = require('gulp-livereload')
const sass = require('gulp-sass');
const rename = require('gulp-rename');


gulp.task('sass', function () {
    return gulp.src('./assets/scss/*.scss')
    .pipe(sass().on('error', sass.logError))
    // .pipe(minifycss())
    .pipe(rename('style.css'))
    .pipe(gulp.dest('./public/css'));
});

// .pipe(rename('app.js'))
gulp.task('js', function () {
    return gulp.src('./assets/js/resil-it.js')
    .pipe(rename('app.js'))
    .pipe(gulp.dest('./public/js'));
});


gulp.task('serve', () => {
    livereload.listen()

    gulp.watch('./assets/scss/*.scss', gulp.series('sass'));
    gulp.watch('./assets/js/*.js', gulp.series('js'));
    // start express app
    nodemon({
        script: 'bin/www',
        ext: 'js nunjucks',
        ignore: [
            'assets/',
            'public/',
            'node_modules/'
        ],
        env: { NODE_ENV: process.env.NODE_ENV }
    })
    .on('restart', () => {
        gulp
        .src('bin/www')
        .pipe(livereload())
    })
})
